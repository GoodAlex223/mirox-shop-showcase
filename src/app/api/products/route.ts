import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { getSalesRanking } from "@/lib/product-queries";
import { VARIANT_NAMES } from "@/lib/variant-names";

export const dynamic = "force-dynamic";

interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
}

function getPagination(searchParams: URLSearchParams): PaginationParams {
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(48, Math.max(1, parseInt(searchParams.get("limit") || "12", 10)));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

const LIST_SELECT = {
  id: true,
  name: true,
  slug: true,
  shortDesc: true,
  price: true,
  comparePrice: true,
  stock: true,
  isFeatured: true,
  createdAt: true,
  category: { select: { id: true, name: true, slug: true } },
  images: {
    select: { id: true, url: true, alt: true },
    orderBy: { position: "asc" as const },
  },
  variants: {
    select: { id: true, name: true, value: true, stock: true, price: true },
    // Deterministic "first colorway (Колір) row" for consumers deriving a colorway
    // (QuickViewDialog cart lines) — same tiebreaker as the PDP query.
    orderBy: [{ createdAt: "asc" as const }, { id: "asc" as const }],
  },
};

// GET /api/products - Public product listing
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const { page, limit, skip } = getPagination(searchParams);

    // Filters
    const search = searchParams.get("search") || "";
    const categorySlug = searchParams.get("category");
    const minPrice = searchParams.get("minPrice");
    const maxPrice = searchParams.get("maxPrice");
    const featured = searchParams.get("featured");

    // Build where clause - only active products
    const where: Prisma.ProductWhereInput = {
      isActive: true,
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { shortDesc: { contains: search, mode: "insensitive" } },
      ];
    }

    if (categorySlug) {
      // Two-level rollup (G12): match the product's own category OR its
      // category's parent, so a parent slug lists descendants' products.
      // Must nest inside the relation filter — top-level where.OR is owned
      // by the search filter above.
      where.category = { OR: [{ slug: categorySlug }, { parent: { slug: categorySlug } }] };
    }

    if (minPrice) {
      where.price = { ...((where.price as object) || {}), gte: parseFloat(minPrice) };
    }

    if (maxPrice) {
      where.price = { ...((where.price as object) || {}), lte: parseFloat(maxPrice) };
    }

    if (featured === "true") {
      where.isFeatured = true;
    }

    // Explicit id list (recently-viewed): capped, blank-tolerant, still isActive-only.
    const idsParam = searchParams.get("ids");
    if (idsParam) {
      const ids = idsParam
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 12);
      if (ids.length > 0) {
        where.id = { in: ids };
      }
    }

    // Filter by variants (size, color)
    const size = searchParams.get("size");
    const color = searchParams.get("color");
    const brand = searchParams.get("brand");
    const inStock = searchParams.get("inStock");

    const variantConditions: Prisma.ProductWhereInput[] = [];
    if (size) {
      variantConditions.push({ variants: { some: { name: VARIANT_NAMES.size, value: size } } });
    }
    if (color) {
      variantConditions.push({ variants: { some: { name: VARIANT_NAMES.color, value: color } } });
    }
    if (variantConditions.length > 0) {
      where.AND = variantConditions;
    }
    if (brand) {
      where.brand = brand;
    }
    if (inStock === "true") {
      where.stock = { gt: 0 };
    }

    // Sort
    const VALID_SORTS = ["new", "popular", "price-asc", "price-desc"] as const;
    const sortParam = searchParams.get("sort");
    const sort = (VALID_SORTS as readonly string[]).includes(sortParam ?? "")
      ? (sortParam as (typeof VALID_SORTS)[number])
      : sortParam !== null
        ? "new" // explicit but invalid → default
        : null; // absent → legacy path

    let products;
    let total: number;

    if (sort === "popular") {
      const [rankedIds, matching, matchTotal] = await Promise.all([
        getSalesRanking(90),
        prisma.product.findMany({ where, select: { id: true, createdAt: true } }),
        prisma.product.count({ where }),
      ]);
      const rank = new Map(rankedIds.map((id, index) => [id, index]));
      const pageIds = matching
        .sort((a, b) => {
          const ra = rank.get(a.id);
          const rb = rank.get(b.id);
          if (ra !== undefined && rb !== undefined) return ra - rb;
          if (ra !== undefined) return -1;
          if (rb !== undefined) return 1;
          return b.createdAt.getTime() - a.createdAt.getTime();
        })
        .slice(skip, skip + limit)
        .map((p) => p.id);
      const rows = await prisma.product.findMany({
        where: { id: { in: pageIds } },
        select: LIST_SELECT,
      });
      // `in` does not preserve order — re-impose the page order.
      const byId = new Map(rows.map((r) => [r.id, r]));
      products = pageIds.map((id) => byId.get(id)).filter((p) => p !== undefined);
      total = matchTotal;
    } else {
      const orderBy: Prisma.ProductOrderByWithRelationInput = {};
      if (sort === "price-asc") orderBy.price = "asc";
      else if (sort === "price-desc") orderBy.price = "desc";
      else if (sort === "new") orderBy.createdAt = "desc";
      else {
        // Legacy path (sort absent): sortBy/sortOrder exactly as before.
        const sortBy = searchParams.get("sortBy") || "createdAt";
        const sortOrder = searchParams.get("sortOrder") || "desc";
        const validSortFields = ["name", "price", "createdAt"];
        if (validSortFields.includes(sortBy)) {
          orderBy[sortBy as keyof Prisma.ProductOrderByWithRelationInput] =
            sortOrder === "asc" ? "asc" : "desc";
        }
      }
      const [rows, rowTotal] = await Promise.all([
        prisma.product.findMany({ where, select: LIST_SELECT, orderBy, skip, take: limit }),
        prisma.product.count({ where }),
      ]);
      products = rows;
      total = rowTotal;
    }

    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      data: products,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch products" }, { status: 500 });
  }
}
