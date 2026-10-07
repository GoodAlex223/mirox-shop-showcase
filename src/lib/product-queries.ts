import { prisma } from "@/lib/db";

/**
 * Serialized product shape consumed by <ProductCard>. Prisma returns Decimal
 * for price fields, which cannot cross the server/client boundary — these are
 * stringified here so callers never have to remember to do it.
 */
export interface ProductCardData {
  id: string;
  name: string;
  slug: string;
  shortDesc: string | null;
  price: string;
  comparePrice: string | null;
  stock: number;
  isFeatured: boolean;
  createdAt: Date | string;
  category: { name: string; slug: string };
  images: { url: string; alt: string | null }[];
  /** Every variant row (Size and Color alike) — <ProductCard> filters to Size itself. */
  variants: { name: string; value: string }[];
}

/**
 * Order statuses representing a sale that actually stuck. PENDING is excluded
 * because the sale isn't real yet; CANCELLED and REFUNDED because it didn't
 * hold. Kept as string literals so the list is assertable in tests without
 * importing the Prisma enum.
 */
const COUNTED_STATUSES = ["CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED"] as const;

const PRODUCT_CARD_SELECT = {
  id: true,
  name: true,
  slug: true,
  shortDesc: true,
  price: true,
  comparePrice: true,
  stock: true,
  isFeatured: true,
  createdAt: true,
  category: { select: { name: true, slug: true } },
  images: {
    select: { url: true, alt: true },
    orderBy: { position: "asc" as const },
    take: 1,
  },
  variants: { select: { name: true, value: true } },
};

type RawProduct = Omit<ProductCardData, "price" | "comparePrice"> & {
  price: { toString(): string };
  comparePrice: { toString(): string } | null;
};

function serialize(product: RawProduct): ProductCardData {
  return {
    ...product,
    price: product.price.toString(),
    comparePrice: product.comparePrice?.toString() ?? null,
  };
}

export async function getFeaturedProducts(limit = 8): Promise<ProductCardData[]> {
  const products = await prisma.product.findMany({
    where: { isActive: true, isFeatured: true },
    select: PRODUCT_CARD_SELECT,
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return (products as RawProduct[]).map(serialize);
}

export async function getNewArrivals(limit = 8): Promise<ProductCardData[]> {
  const products = await prisma.product.findMany({
    where: { isActive: true },
    select: PRODUCT_CARD_SELECT,
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return (products as RawProduct[]).map(serialize);
}

/**
 * Where the bestsellers came from. Exposed so callers never present new
 * arrivals as bestsellers without knowing they're doing it.
 */
export type BestsellerSource = "orders" | "backfilled" | "mixed";

export interface BestsellerResult {
  products: ProductCardData[];
  source: BestsellerSource;
}

/**
 * Product IDs ranked by units sold (desc) over a trailing window, counting
 * only orders that stuck. Shared by getBestsellers() and the catalog's
 * `sort=popular` (/api/products) so "popular" has exactly one definition.
 */
export async function getSalesRanking(windowDays = 90, take?: number): Promise<string[]> {
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

  const grouped = await prisma.orderItem.groupBy({
    by: ["productId"],
    where: {
      order: { status: { in: [...COUNTED_STATUSES] }, createdAt: { gte: since } },
    },
    _sum: { quantity: true },
    orderBy: { _sum: { quantity: "desc" } },
    ...(take !== undefined ? { take } : {}),
  });

  return grouped.map((group) => group.productId);
}

/**
 * Real bestsellers: units sold per product over a trailing window, counting
 * only orders that stuck. Backfills from new arrivals when order history is
 * too thin to fill the rail — the normal state of a new store.
 */
// TASK-036's "popular" sort imports getSalesRanking() above for the same
// definition — this function (getBestsellers) has no catalog consumer.
export async function getBestsellers(limit = 8, windowDays = 90): Promise<BestsellerResult> {
  const rankedIds = await getSalesRanking(windowDays, limit);

  const ranked = rankedIds.length
    ? await prisma.product.findMany({
        where: { id: { in: rankedIds }, isActive: true },
        select: PRODUCT_CARD_SELECT,
      })
    : [];

  // Prisma's `in` filter returns rows in arbitrary order, so re-impose the
  // sales ranking rather than trusting the query's ordering.
  const byId = new Map((ranked as RawProduct[]).map((p) => [p.id, p]));
  const fromOrders = rankedIds
    .map((id) => byId.get(id))
    .filter((p): p is RawProduct => p !== undefined)
    .map(serialize);

  if (fromOrders.length >= limit) {
    return { products: fromOrders, source: "orders" };
  }

  const seen = new Set(fromOrders.map((p) => p.id));
  const backfill = (await getNewArrivals(limit + fromOrders.length))
    .filter((p) => !seen.has(p.id))
    .slice(0, limit - fromOrders.length);

  // Label reflects what actually landed in `products`, not just whether
  // orders alone filled the rail — a small catalog can leave the backfill
  // empty even when fromOrders didn't reach `limit` on its own, and that
  // case must report "orders", not "mixed".
  const source: BestsellerSource =
    fromOrders.length === 0 ? "backfilled" : backfill.length === 0 ? "orders" : "mixed";

  return {
    products: [...fromOrders, ...backfill],
    source,
  };
}
