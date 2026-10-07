import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { productVariantSchema } from "@/lib/validations";
import { requireAdmin, apiError, apiSuccess } from "@/lib/api-utils";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/admin/products/[id]/variants - List a product's variants
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const { id } = await params;

    const product = await prisma.product.findUnique({ where: { id }, select: { id: true } });
    if (!product) {
      return apiError("Product not found", 404, "PRODUCT_NOT_FOUND");
    }

    const variants = await prisma.productVariant.findMany({
      where: { productId: id },
      // Same tiebreaker as the PDP query: rows can share a createdAt.
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });

    return apiSuccess(variants);
  } catch {
    return apiError("Failed to fetch variants", 500);
  }
}

// POST /api/admin/products/[id]/variants - Add a variant
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const { id } = await params;
    const body = await request.json();

    const product = await prisma.product.findUnique({ where: { id }, select: { id: true } });
    if (!product) {
      return apiError("Product not found", 404, "PRODUCT_NOT_FOUND");
    }

    const validationResult = productVariantSchema.safeParse(body);
    if (!validationResult.success) {
      return apiError(validationResult.error.issues[0].message, 400, "VALIDATION_ERROR");
    }
    const data = validationResult.data;

    const duplicate = await prisma.productVariant.findFirst({
      where: { productId: id, name: data.name, value: data.value },
      select: { id: true },
    });
    if (duplicate) {
      return apiError("This variant already exists on the product", 400, "DUPLICATE_VARIANT");
    }

    const variant = await prisma.productVariant.create({
      data: { productId: id, name: data.name, value: data.value, stock: data.stock },
    });

    return apiSuccess(variant, 201);
  } catch {
    return apiError("Failed to add variant", 500);
  }
}
