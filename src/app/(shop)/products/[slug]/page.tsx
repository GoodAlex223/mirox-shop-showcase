import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import {
  getProductMetadata,
  getProductJsonLd,
  getBreadcrumbJsonLd,
  serializeJsonLd,
  siteConfig,
} from "@/lib/seo";
import { safeSection } from "@/lib/safe-section";
import { getSalesRanking } from "@/lib/product-queries";
import { VARIANT_NAMES } from "@/lib/variant-names";
import type { BundleCompanion, StyleSibling } from "@/types";
import { ProductDetailClient, ProductNotFound, type Product } from "./product-detail-client";

interface PageProps {
  params: Promise<{ slug: string }>;
}

async function getProduct(slug: string): Promise<Product | null> {
  const product = await prisma.product.findUnique({
    where: { slug, isActive: true },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      shortDesc: true,
      metaTitle: true,
      metaDesc: true,
      price: true,
      comparePrice: true,
      stock: true,
      sku: true,
      isFeatured: true,
      styleGroup: true,
      category: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
      images: {
        select: {
          id: true,
          url: true,
          alt: true,
        },
        orderBy: { position: "asc" },
      },
      variants: {
        select: {
          id: true,
          name: true,
          value: true,
          sku: true,
          price: true,
          stock: true,
        },
        // id tiebreaker: seeded rows can share a createdAt timestamp, which
        // otherwise leaves "the first colorway (Колір) row" (→ colorValue) nondeterministic.
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      },
    },
  });

  if (!product) return null;

  // Colorway siblings (TASK-037): same styleGroup, other products, active.
  const siblingRows = product.styleGroup
    ? await safeSection(
        prisma.product.findMany({
          where: {
            styleGroup: product.styleGroup,
            id: { not: product.id },
            isActive: true,
          },
          select: {
            slug: true,
            name: true,
            variants: { where: { name: VARIANT_NAMES.color }, select: { value: true }, take: 1 },
          },
        }),
        [],
        "pdp:style-siblings"
      )
    : [];

  const styleSiblings: StyleSibling[] = siblingRows.map((s) => ({
    slug: s.slug,
    name: s.name,
    colorValue: s.variants[0]?.value ?? null,
  }));

  // Bundle companions (TASK-037): top sellers excluding this product; fill
  // deterministically from same-category then any active (createdAt desc).
  const companionSelect = {
    id: true,
    name: true,
    slug: true,
    price: true,
    comparePrice: true,
    stock: true,
    categoryId: true,
    category: { select: { name: true } },
    images: { select: { url: true, alt: true }, orderBy: { position: "asc" as const }, take: 1 },
    variants: {
      where: { name: { in: [VARIANT_NAMES.size, VARIANT_NAMES.color] } },
      select: { id: true, name: true, value: true, stock: true, price: true },
      // Same tiebreaker as the main-product query above: seeded rows can share
      // a createdAt, which otherwise leaves "the first colorway (Колір) row" (→ colorValue)
      // nondeterministic.
      orderBy: [{ createdAt: "asc" as const }, { id: "asc" as const }],
    },
  };

  const companions: BundleCompanion[] = await safeSection(
    (async () => {
      const rankedIds = (await getSalesRanking(90)).filter((id) => id !== product.id);
      const picked = new Map<string, Awaited<ReturnType<typeof fetchCompanions>>[number]>();

      async function fetchCompanions(ids: string[]) {
        if (ids.length === 0) return [];
        return prisma.product.findMany({
          where: { id: { in: ids }, isActive: true, stock: { gt: 0 } },
          select: companionSelect,
        });
      }

      const rankedRows = await fetchCompanions(rankedIds.slice(0, 6));
      const rowById = new Map(rankedRows.map((r) => [r.id, r]));
      for (const id of rankedIds) {
        const row = rowById.get(id);
        if (row && picked.size < 2) picked.set(id, row);
      }

      if (picked.size < 2) {
        const fill = await prisma.product.findMany({
          where: {
            isActive: true,
            stock: { gt: 0 },
            id: { notIn: [product.id, ...picked.keys()] },
          },
          select: companionSelect,
          orderBy: { createdAt: "desc" },
          take: 4,
        });
        // Same-category fill first, then the rest; Array.prototype.sort is
        // stable, so createdAt desc is preserved within each group.
        const preferred = fill.sort((a, b) => {
          const aSame = a.categoryId === product.category.id ? 0 : 1;
          const bSame = b.categoryId === product.category.id ? 0 : 1;
          return aSame - bSame;
        });
        for (const row of preferred) {
          if (picked.size >= 2) break;
          picked.set(row.id, row);
        }
      }

      return [...picked.values()].map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        price: c.price.toString(),
        comparePrice: c.comparePrice?.toString() ?? null,
        stock: c.stock,
        image: c.images[0] ?? null,
        category: c.category ?? null,
        sizeVariants: c.variants
          .filter((v) => v.name === VARIANT_NAMES.size)
          .map((v) => ({
            id: v.id,
            value: v.value,
            stock: v.stock,
            price: v.price?.toString() ?? null,
          })),
        colorValue: c.variants.find((v) => v.name === VARIANT_NAMES.color)?.value ?? null,
      }));
    })(),
    [],
    "pdp:companions"
  );

  // Get related products from same category
  const relatedProducts = await safeSection(
    prisma.product.findMany({
      where: {
        categoryId: product.category.id,
        isActive: true,
        id: { not: product.id },
      },
      select: {
        id: true,
        name: true,
        slug: true,
        shortDesc: true,
        price: true,
        comparePrice: true,
        stock: true,
        isFeatured: true,
        category: {
          select: {
            name: true,
            slug: true,
          },
        },
        images: {
          select: {
            url: true,
            alt: true,
          },
          orderBy: { position: "asc" },
          take: 1,
        },
      },
      take: 4,
    }),
    [],
    "pdp:related"
  );

  // Fetch reviews and stats
  const [reviews, reviewStats, reviewDistribution] = await Promise.all([
    safeSection(
      prisma.review.findMany({
        where: { productId: product.id, isHidden: false },
        select: {
          id: true,
          rating: true,
          comment: true,
          adminReply: true,
          adminRepliedAt: true,
          createdAt: true,
          user: { select: { id: true, name: true, image: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      [],
      "pdp:reviews"
    ),
    safeSection(
      prisma.review.aggregate({
        where: { productId: product.id, isHidden: false },
        _avg: { rating: true },
        _count: true,
      }),
      { _avg: { rating: null }, _count: 0 },
      "pdp:review-stats"
    ),
    safeSection(
      prisma.review.groupBy({
        by: ["rating"],
        where: { productId: product.id, isHidden: false },
        _count: true,
      }),
      [],
      "pdp:review-distribution"
    ),
  ]);

  const ratingDistribution = [5, 4, 3, 2, 1].map((r) => ({
    rating: r,
    count: reviewDistribution.find((d) => d.rating === r)?._count ?? 0,
  }));

  return {
    ...product,
    price: product.price.toString(),
    comparePrice: product.comparePrice?.toString() ?? null,
    colorValue: product.variants.find((v) => v.name === VARIANT_NAMES.color)?.value ?? null,
    styleSiblings,
    companions,
    variants: product.variants.map((v) => ({
      ...v,
      value: v.value,
      price: v.price?.toString() ?? product.price.toString(),
      sku: v.sku ?? product.sku,
      options: {},
    })),
    relatedProducts: relatedProducts.map((p) => ({
      ...p,
      price: p.price.toString(),
      comparePrice: p.comparePrice?.toString() ?? null,
    })),
    reviews: reviews.map((r) => ({
      ...r,
      adminRepliedAt: r.adminRepliedAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
    })),
    averageRating: reviewStats._avg.rating ?? 0,
    totalReviews: reviewStats._count,
    ratingDistribution,
  };
}

/**
 * Slim query for generateMetadata (perf, final-review wave): the full
 * getProduct() above also runs sibling/companion/ranking/related/review
 * queries that metadata generation never touches.
 */
async function getProductForMetadata(slug: string) {
  return prisma.product.findUnique({
    where: { slug, isActive: true },
    select: {
      name: true,
      slug: true,
      description: true,
      shortDesc: true,
      metaTitle: true,
      metaDesc: true,
      price: true,
      comparePrice: true,
      category: { select: { name: true, slug: true } },
    },
  });
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  // Fix round 1 (post-Task-8 review): "Product Not Found" was hardcoded
  // English here — same fixed-set class as categories/[slug]/page.tsx's
  // "Category Not Found" that Task 8 already converted, just missed one
  // file over. Mirrors that fix exactly: Promise.all + seo.productNotFound.
  const [product, t] = await Promise.all([getProductForMetadata(slug), getTranslations("seo")]);

  if (!product) {
    return {
      title: t("productNotFound"),
    };
  }

  // Task 8: getProductMetadata is now async (its last-resort description
  // fallback reads the i18n catalog's brand.description).
  return await getProductMetadata({
    name: product.name,
    slug: product.slug,
    description: product.description,
    shortDesc: product.shortDesc,
    metaTitle: product.metaTitle,
    metaDesc: product.metaDesc,
    price: product.price.toString(),
    comparePrice: product.comparePrice?.toString() ?? null,
    category: product.category,
  });
}

export default async function ProductDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const [product, t] = await Promise.all([getProduct(slug), getTranslations("products")]);

  if (!product) {
    return <ProductNotFound />;
  }

  // Generate JSON-LD structured data (single Product schema with optional reviews)
  const productJsonLd = getProductJsonLd({
    name: product.name,
    slug: product.slug,
    description: product.description,
    price: product.price,
    comparePrice: product.comparePrice,
    sku: product.sku,
    stock: product.stock,
    images: product.images,
    category: product.category,
    reviews: product.reviews.map((r) => ({
      rating: r.rating,
      comment: r.comment,
      authorName: r.user.name || "Anonymous",
      createdAt: r.createdAt,
    })),
    averageRating: product.averageRating,
    reviewCount: product.totalReviews,
  });

  const breadcrumbJsonLd = getBreadcrumbJsonLd([
    { name: t("breadcrumbHome"), url: siteConfig.url },
    { name: t("catalogName"), url: `${siteConfig.url}/products` },
    { name: product.name, url: `${siteConfig.url}/products/${product.slug}` },
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(productJsonLd),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(breadcrumbJsonLd),
        }}
      />
      {/* key: sibling-colorway navigation soft-navigates within this same route
          template, so without a key the client instance (and its selectedSizeId
          state) is reused across products — stale variant ids made the CTA add
          variantId: undefined / maxStock: 0 lines (PR #27 review). */}
      <ProductDetailClient key={product.id} product={product} />
    </>
  );
}
