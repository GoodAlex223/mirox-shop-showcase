import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, apiError, apiSuccess } from "@/lib/api-utils";
import { z } from "zod";

interface RouteParams {
  params: Promise<{ id: string; imageId: string }>;
}

const updateImageSchema = z.object({
  alt: z.string().optional(),
  url: z.string().url("Invalid image URL").optional(),
});

// PUT /api/admin/products/[id]/images/[imageId] - Update image
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const { id, imageId } = await params;
    const body = await request.json();

    // Check if image exists and belongs to product
    const existingImage = await prisma.productImage.findFirst({
      where: { id: imageId, productId: id },
    });

    if (!existingImage) {
      return apiError("Image not found", 404);
    }

    // Validate input
    const validationResult = updateImageSchema.safeParse(body);
    if (!validationResult.success) {
      return apiError(validationResult.error.issues[0].message, 400);
    }

    const data = validationResult.data;

    // Update image
    const image = await prisma.productImage.update({
      where: { id: imageId },
      data: {
        ...(data.alt !== undefined && { alt: data.alt }),
        ...(data.url && { url: data.url }),
      },
    });

    return apiSuccess(image);
  } catch {
    return apiError("Failed to update image", 500);
  }
}

// DELETE /api/admin/products/[id]/images/[imageId] - Delete image
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const { id, imageId } = await params;

    // Check if image exists and belongs to product
    const image = await prisma.productImage.findFirst({
      where: { id: imageId, productId: id },
    });

    if (!image) {
      return apiError("Image not found", 404);
    }

    // Delete image
    await prisma.productImage.delete({ where: { id: imageId } });

    return apiSuccess({ message: "Image deleted successfully" });
  } catch {
    return apiError("Failed to delete image", 500);
  }
}
