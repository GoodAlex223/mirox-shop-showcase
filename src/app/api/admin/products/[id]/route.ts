import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { productBaseSchema } from "@/lib/validations";
import { requireAdmin, apiError, apiSuccess } from "@/lib/api-utils";
import { generateSlug, nonBlankSlug } from "@/lib/slug";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/admin/products/[id] - Get single product
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const { id } = await params;

    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        supplier: { select: { id: true, name: true, code: true } },
        images: { orderBy: { position: "asc" } },
        variants: { orderBy: { createdAt: "asc" } },
        _count: { select: { orderItems: true, cartItems: true } },
      },
    });

    if (!product) {
      return apiError("Product not found", 404);
    }

    return apiSuccess(product);
  } catch {
    return apiError("Failed to fetch product", 500);
  }
}

// PUT /api/admin/products/[id] - Update product
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const { id } = await params;
    const body = await request.json();

    // Check if product exists
    const existingProduct = await prisma.product.findUnique({ where: { id } });
    if (!existingProduct) {
      return apiError("Product not found", 404, "PRODUCT_NOT_FOUND");
    }

    // Validate input
    const validationResult = productBaseSchema.partial().safeParse(body);
    if (!validationResult.success) {
      return apiError(validationResult.error.issues[0].message, 400, "VALIDATION_ERROR");
    }

    const data = validationResult.data;

    // G24 slug rule. A slug sent back as stored is kept byte for byte — never
    // re-normalized, so no live URL moves. A different typed slug is normalized
    // and must be free. With the field blank, a rename regenerates it from the
    // new name. An empty result is rejected, never stored.
    const typedSlug = nonBlankSlug(data.slug);
    let slug: string | undefined;
    if (typedSlug !== undefined && typedSlug !== existingProduct.slug) {
      slug = generateSlug(typedSlug);
      if (!slug) {
        return apiError("Slug must contain a letter or digit", 400, "SLUG_EMPTY");
      }
      if (slug !== existingProduct.slug && (await prisma.product.findUnique({ where: { slug } }))) {
        return apiError("Slug already exists", 400, "SLUG_TAKEN");
      }
    } else if (typedSlug === undefined && data.name && data.name !== existingProduct.name) {
      slug = generateSlug(data.name);
      if (!slug) {
        return apiError("Slug must contain a letter or digit", 400, "SLUG_EMPTY");
      }
      if (slug !== existingProduct.slug && (await prisma.product.findUnique({ where: { slug } }))) {
        slug = `${slug}-${Date.now().toString(36)}`;
      }
    }

    // Check SKU uniqueness if changed
    if (data.sku && data.sku !== existingProduct.sku) {
      const existingSku = await prisma.product.findUnique({ where: { sku: data.sku } });
      if (existingSku) {
        return apiError("SKU already exists", 400, "SKU_TAKEN");
      }
    }

    // Verify category exists if changed
    if (data.categoryId && data.categoryId !== existingProduct.categoryId) {
      const category = await prisma.category.findUnique({ where: { id: data.categoryId } });
      if (!category) {
        return apiError("Category not found", 400, "CATEGORY_NOT_FOUND");
      }
    }

    // Update product
    const product = await prisma.product.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name }),
        ...(slug !== undefined && slug !== existingProduct.slug && { slug }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.shortDesc !== undefined && { shortDesc: data.shortDesc }),
        ...(data.price !== undefined && { price: data.price }),
        ...(data.comparePrice !== undefined && { comparePrice: data.comparePrice }),
        ...(data.costPrice !== undefined && { costPrice: data.costPrice }),
        ...(data.sku && { sku: data.sku }),
        ...(data.barcode !== undefined && { barcode: data.barcode }),
        ...(data.brand !== undefined && { brand: data.brand }),
        ...(data.mpn !== undefined && { mpn: data.mpn }),
        ...(data.styleGroup !== undefined && { styleGroup: data.styleGroup }),
        ...(data.excludeFromFeed !== undefined && { excludeFromFeed: data.excludeFromFeed }),
        ...(data.stock !== undefined && { stock: data.stock }),
        ...(data.categoryId && { categoryId: data.categoryId }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        ...(data.isFeatured !== undefined && { isFeatured: data.isFeatured }),
      },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        supplier: { select: { id: true, name: true, code: true } },
        images: { orderBy: { position: "asc" } },
      },
    });

    return apiSuccess(product);
  } catch {
    return apiError("Failed to update product", 500, "UPDATE_FAILED");
  }
}

// DELETE /api/admin/products/[id] - Delete product
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const { id } = await params;

    // Check if product exists
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        _count: { select: { orderItems: true, cartItems: true } },
      },
    });

    if (!product) {
      return apiError("Product not found", 404);
    }

    // Check if product has orders
    if (product._count.orderItems > 0) {
      return apiError(
        "Cannot delete product with existing orders. Consider deactivating it instead.",
        400
      );
    }

    // Delete product (cascades to images, variants, cart items)
    await prisma.product.delete({ where: { id } });

    return apiSuccess({ message: "Product deleted successfully" });
  } catch {
    return apiError("Failed to delete product", 500);
  }
}
