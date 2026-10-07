import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { productSchema } from "@/lib/validations";
import {
  requireAdmin,
  apiError,
  apiSuccess,
  getPagination,
  paginatedResponse,
} from "@/lib/api-utils";
import { slugFromInput } from "@/lib/slug";
import { Prisma } from "@prisma/client";

// GET /api/admin/products - List products with pagination, search, and filters
export async function GET(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const searchParams = request.nextUrl.searchParams;
    const { page, limit, skip } = getPagination(searchParams);

    // Filters
    const search = searchParams.get("search") || "";
    const categoryId = searchParams.get("categoryId");
    const isActive = searchParams.get("isActive");
    const isFeatured = searchParams.get("isFeatured");
    const supplierId = searchParams.get("supplierId");
    const sortBy = searchParams.get("sortBy") || "createdAt";
    const sortOrder = searchParams.get("sortOrder") || "desc";

    // Build where clause
    const where: Prisma.ProductWhereInput = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { sku: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    if (categoryId) {
      where.categoryId = categoryId;
    }

    if (isActive !== null && isActive !== undefined) {
      where.isActive = isActive === "true";
    }

    if (isFeatured !== null && isFeatured !== undefined) {
      where.isFeatured = isFeatured === "true";
    }

    if (supplierId) {
      where.supplierId = supplierId;
    }

    // Build order by
    const orderBy: Prisma.ProductOrderByWithRelationInput = {};
    if (["name", "price", "stock", "createdAt", "updatedAt"].includes(sortBy)) {
      orderBy[sortBy as keyof Prisma.ProductOrderByWithRelationInput] =
        sortOrder === "asc" ? "asc" : "desc";
    }

    // Execute queries
    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
          category: { select: { id: true, name: true, slug: true } },
          supplier: { select: { id: true, name: true, code: true } },
          images: { orderBy: { position: "asc" }, take: 1 },
          _count: { select: { variants: true, orderItems: true } },
        },
        orderBy,
        skip,
        take: limit,
      }),
      prisma.product.count({ where }),
    ]);

    return apiSuccess(paginatedResponse(products, total, { page, limit, skip }));
  } catch {
    return apiError("Failed to fetch products", 500);
  }
}

// POST /api/admin/products - Create a new product
export async function POST(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const body = await request.json();

    // Validate input
    const validationResult = productSchema.safeParse(body);
    if (!validationResult.success) {
      return apiError(validationResult.error.issues[0].message, 400, "VALIDATION_ERROR");
    }

    const data = validationResult.data;

    // G24: the typed slug when there is one, else the name — normalized either
    // way (Ukrainian → Latin). An empty result is rejected, never stored.
    let slug = slugFromInput(data.slug, data.name);
    if (!slug) {
      return apiError("Slug must contain a letter or digit", 400, "SLUG_EMPTY");
    }
    const existingSlug = await prisma.product.findUnique({ where: { slug } });
    if (existingSlug) {
      slug = `${slug}-${Date.now().toString(36)}`;
    }

    // Check if SKU is unique
    const existingSku = await prisma.product.findUnique({ where: { sku: data.sku } });
    if (existingSku) {
      return apiError("SKU already exists", 400, "SKU_TAKEN");
    }

    // Verify category exists
    const category = await prisma.category.findUnique({ where: { id: data.categoryId } });
    if (!category) {
      return apiError("Category not found", 400, "CATEGORY_NOT_FOUND");
    }

    // Create product
    const product = await prisma.product.create({
      data: {
        name: data.name,
        slug,
        description: data.description,
        shortDesc: data.shortDesc,
        price: data.price,
        comparePrice: data.comparePrice,
        costPrice: data.costPrice,
        sku: data.sku,
        barcode: data.barcode,
        brand: data.brand,
        mpn: data.mpn,
        styleGroup: data.styleGroup,
        excludeFromFeed: data.excludeFromFeed,
        stock: data.stock,
        categoryId: data.categoryId,
        isActive: data.isActive,
        isFeatured: data.isFeatured,
      },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        images: true,
      },
    });

    return apiSuccess(product, 201);
  } catch {
    return apiError("Failed to create product", 500, "CREATE_FAILED");
  }
}
