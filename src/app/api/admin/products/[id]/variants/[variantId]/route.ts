import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { productVariantUpdateSchema } from "@/lib/validations";
import { requireAdmin, apiError, apiSuccess } from "@/lib/api-utils";

interface RouteParams {
  params: Promise<{ id: string; variantId: string }>;
}

// PATCH /api/admin/products/[id]/variants/[variantId] - Update a variant
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const { id, variantId } = await params;
    const body = await request.json();

    const existing = await prisma.productVariant.findFirst({
      where: { id: variantId, productId: id },
    });
    if (!existing) {
      return apiError("Variant not found", 404, "VARIANT_NOT_FOUND");
    }

    const validationResult = productVariantUpdateSchema.safeParse(body);
    if (!validationResult.success) {
      return apiError(validationResult.error.issues[0].message, 400, "VALIDATION_ERROR");
    }
    const data = validationResult.data;

    // Same invariant POST enforces: no two rows on a product may share
    // name+value. Compare against the *resulting* name/value — the incoming
    // field if present, otherwise the row's current value — so a PATCH that
    // only touches `value` still checks against the unchanged `name`, and
    // vice versa. Exclude this row itself so a no-op PATCH doesn't self-match.
    const resultingName = data.name ?? existing.name;
    const resultingValue = data.value ?? existing.value;

    const duplicate = await prisma.productVariant.findFirst({
      where: { productId: id, name: resultingName, value: resultingValue, id: { not: variantId } },
      select: { id: true },
    });
    if (duplicate) {
      return apiError("This variant already exists on the product", 400, "DUPLICATE_VARIANT");
    }

    const variant = await prisma.productVariant.update({
      where: { id: variantId },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.value !== undefined && { value: data.value }),
        ...(data.stock !== undefined && { stock: data.stock }),
      },
    });

    return apiSuccess(variant);
  } catch {
    return apiError("Failed to update variant", 500);
  }
}

// DELETE /api/admin/products/[id]/variants/[variantId] - Delete a variant
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const { id, variantId } = await params;

    const variant = await prisma.productVariant.findFirst({
      where: { id: variantId, productId: id },
      include: { _count: { select: { orderItems: true, cartItems: true } } },
    });
    if (!variant) {
      return apiError("Variant not found", 404, "VARIANT_NOT_FOUND");
    }

    // No onDelete on the OrderItem/CartItem relations — a referenced variant
    // would be an FK error; refuse explicitly instead.
    if (variant._count.orderItems > 0 || variant._count.cartItems > 0) {
      return apiError(
        "Cannot delete a variant that is referenced by orders or carts. Set its stock to 0 instead.",
        400,
        "VARIANT_REFERENCED"
      );
    }

    await prisma.productVariant.delete({ where: { id: variantId } });

    return apiSuccess({ message: "Variant deleted successfully" });
  } catch {
    return apiError("Failed to delete variant", 500);
  }
}
