import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    product: { findMany: vi.fn() },
    orderItem: { groupBy: vi.fn() },
  },
}));

import { prisma } from "@/lib/db";
import {
  getBestsellers,
  getFeaturedProducts,
  getNewArrivals,
  getSalesRanking,
} from "@/lib/product-queries";

const findMany = prisma.product.findMany as unknown as ReturnType<typeof vi.fn>;
const groupBy = prisma.orderItem.groupBy as unknown as ReturnType<typeof vi.fn>;

/** Minimal row shaped like the PRODUCT_CARD_SELECT result. */
function row(id: string, name = `Product ${id}`) {
  return {
    id,
    name,
    slug: `product-${id}`,
    shortDesc: null,
    price: { toString: () => "100.00" },
    comparePrice: null,
    stock: 5,
    isFeatured: false,
    category: { name: "Hoodies", slug: "hoodies" },
    images: [{ url: "https://example.com/a.jpg", alt: null }],
    variants: [],
  };
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;
/** Slack for how long the test itself takes to run, not measurement noise. */
const WINDOW_TOLERANCE_MS = 2000;

/**
 * Asserts `gte` sits `windowDays` days before `before` (captured immediately
 * before the call under test), using a conversion computed independently of
 * the implementation. A regression to hours — or to raw milliseconds — misses
 * by orders of magnitude and fails this, unlike a bare `toBeInstanceOf(Date)`
 * check.
 */
function assertWindowGte(gte: unknown, windowDays: number, before: number) {
  expect(gte).toBeInstanceOf(Date);
  const elapsedMs = before - (gte as Date).getTime();
  expect(Math.abs(elapsedMs - windowDays * MS_PER_DAY)).toBeLessThanOrEqual(WINDOW_TOLERANCE_MS);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getFeaturedProducts", () => {
  it("queries active featured products and serializes Decimal price to string", async () => {
    findMany.mockResolvedValue([row("a")]);

    const result = await getFeaturedProducts(4);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isActive: true, isFeatured: true },
        take: 4,
      })
    );
    expect(result[0].price).toBe("100.00");
    expect(result[0].comparePrice).toBeNull();
  });

  it("selects variant name/value so <ProductCard> can render the sizes row", async () => {
    findMany.mockResolvedValue([
      {
        ...row("a"),
        variants: [
          { name: "Розмір", value: "M" },
          { name: "Колір", value: "Чорний" },
        ],
      },
    ]);

    const result = await getFeaturedProducts(4);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          variants: { select: { name: true, value: true } },
        }),
      })
    );
    expect(result[0].variants).toEqual([
      { name: "Розмір", value: "M" },
      { name: "Колір", value: "Чорний" },
    ]);
  });
});

describe("getNewArrivals", () => {
  it("orders by createdAt descending", async () => {
    findMany.mockResolvedValue([]);

    await getNewArrivals(3);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isActive: true },
        orderBy: { createdAt: "desc" },
        take: 3,
      })
    );
  });
});

describe("getBestsellers", () => {
  it("counts only orders whose sale stuck, within the window", async () => {
    groupBy.mockResolvedValue([]);
    findMany.mockResolvedValue([]);

    const before = Date.now();
    await getBestsellers(4, 90);

    const arg = groupBy.mock.calls[0][0];
    expect(arg.by).toEqual(["productId"]);
    expect(arg.where.order.status.in).toEqual(["CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED"]);
    expect(arg.where.order.status.in).not.toContain("PENDING");
    expect(arg.where.order.status.in).not.toContain("CANCELLED");
    expect(arg.where.order.status.in).not.toContain("REFUNDED");
    expect(arg.orderBy).toEqual({ _sum: { quantity: "desc" } });
    expect(arg.take).toBe(4);
    assertWindowGte(arg.where.order.createdAt.gte, 90, before);
  });

  it("computes the window proportionally for a different windowDays value", async () => {
    groupBy.mockResolvedValue([]);
    findMany.mockResolvedValue([]);

    const before = Date.now();
    await getBestsellers(4, 30);

    const arg = groupBy.mock.calls[0][0];
    assertWindowGte(arg.where.order.createdAt.gte, 30, before);
  });

  it("reports source 'orders' when order data alone fills the rail", async () => {
    groupBy.mockResolvedValue([
      { productId: "a", _sum: { quantity: 9 } },
      { productId: "b", _sum: { quantity: 4 } },
    ]);
    findMany.mockResolvedValueOnce([row("a"), row("b")]);

    const result = await getBestsellers(2);

    expect(result.source).toBe("orders");
    expect(result.products.map((p) => p.id)).toEqual(["a", "b"]);
  });

  it("preserves sales ranking even though findMany returns arbitrary order", async () => {
    groupBy.mockResolvedValue([
      { productId: "a", _sum: { quantity: 9 } },
      { productId: "b", _sum: { quantity: 4 } },
    ]);
    // Prisma's `in` filter does not preserve the order of the id list.
    findMany.mockResolvedValueOnce([row("b"), row("a")]);

    const result = await getBestsellers(2);

    expect(result.products.map((p) => p.id)).toEqual(["a", "b"]);
  });

  it("backfills from new arrivals and reports 'mixed' when history is thin", async () => {
    groupBy.mockResolvedValue([{ productId: "a", _sum: { quantity: 9 } }]);
    findMany
      .mockResolvedValueOnce([row("a")]) // ranked lookup
      .mockResolvedValueOnce([row("a"), row("b"), row("c")]); // new arrivals backfill

    const result = await getBestsellers(3);

    expect(result.source).toBe("mixed");
    // "a" came from orders and must not be duplicated by the backfill.
    expect(result.products.map((p) => p.id)).toEqual(["a", "b", "c"]);
  });

  it("reports 'backfilled' when there is no qualifying order history at all", async () => {
    groupBy.mockResolvedValue([]);
    findMany.mockResolvedValueOnce([row("x"), row("y")]);

    const result = await getBestsellers(2);

    expect(result.source).toBe("backfilled");
    expect(result.products.map((p) => p.id)).toEqual(["x", "y"]);
  });

  it("excludes inactive products that still have sales history", async () => {
    groupBy.mockResolvedValue([
      { productId: "a", _sum: { quantity: 9 } },
      { productId: "gone", _sum: { quantity: 8 } },
    ]);
    // "gone" is filtered out by the isActive clause, so findMany omits it.
    findMany.mockResolvedValueOnce([row("a")]).mockResolvedValueOnce([]);

    const result = await getBestsellers(2);

    expect(result.products.map((p) => p.id)).toEqual(["a"]);
    // fromOrders.length (1) < limit (2) and the backfill deduped to nothing —
    // the exact case that used to be mislabeled "mixed" (Finding 1).
    expect(result.source).toBe("orders");
    expect(findMany.mock.calls[0][0].where).toEqual(expect.objectContaining({ isActive: true }));
  });
});

describe("getSalesRanking", () => {
  it("returns product ids in sales order without a take when none is given", async () => {
    groupBy.mockResolvedValue([
      { productId: "b", _sum: { quantity: 9 } },
      { productId: "a", _sum: { quantity: 4 } },
    ]);

    const before = Date.now();
    const ids = await getSalesRanking(90);

    expect(ids).toEqual(["b", "a"]);
    const arg = groupBy.mock.calls[0][0];
    expect(arg.take).toBeUndefined();
    expect(arg.where.order.status.in).toEqual(["CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED"]);
    assertWindowGte(arg.where.order.createdAt.gte, 90, before);
  });

  it("passes take through when given", async () => {
    groupBy.mockResolvedValue([]);
    await getSalesRanking(90, 4);
    expect(groupBy.mock.calls[0][0].take).toBe(4);
  });
});
