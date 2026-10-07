import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, apiError, apiSuccess } from "@/lib/api-utils";
import { z } from "zod";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const addImageSchema = z.object({
  url: z.string().url("Invalid image URL"),
  alt: z.string().optional(),
  position: z.number().int().min(0).optional(),
});

const reorderImagesSchema = z.object({
  imageIds: z.array(z.string()),
});

// GET /api/admin/products/[id]/images - Get product images
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const { id } = await params;

    const product = await prisma.product.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!product) {
      return apiError("Product not found", 404);
    }

    const images = await prisma.productImage.findMany({
      where: { productId: id },
      orderBy: { position: "asc" },
    });

    return apiSuccess(images);
  } catch {
    return apiError("Failed to fetch images", 500);
  }
}

// POST /api/admin/products/[id]/images - Add image to product
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const { id } = await params;
    const body = await request.json();

    // Check if product exists
    const product = await prisma.product.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!product) {
      return apiError("Product not found", 404);
    }

    // Validate input
    const validationResult = addImageSchema.safeParse(body);
    if (!validationResult.success) {
      return apiError(validationResult.error.issues[0].message, 400);
    }

    const data = validationResult.data;

    // Get max position if not provided
    let position = data.position;
    if (position === undefined) {
      const maxPosition = await prisma.productImage.findFirst({
        where: { productId: id },
        orderBy: { position: "desc" },
        select: { position: true },
      });
      position = (maxPosition?.position ?? -1) + 1;
    }

    // Create image
    const image = await prisma.productImage.create({
      data: {
        productId: id,
        url: data.url,
        alt: data.alt,
        position,
      },
    });

    return apiSuccess(image, 201);
  } catch {
    return apiError("Failed to add image", 500);
  }
}

// PUT /api/admin/products/[id]/images - Reorder images
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const { id } = await params;
    const body = await request.json();

    // Check if product exists
    const product = await prisma.product.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!product) {
      return apiError("Product not found", 404);
    }

    // Validate input
    const validationResult = reorderImagesSchema.safeParse(body);
    if (!validationResult.success) {
      return apiError(validationResult.error.issues[0].message, 400);
    }

    const { imageIds } = validationResult.data;

    // Update positions in a transaction
    await prisma.$transaction(
      imageIds.map((imageId, index) =>
        prisma.productImage.update({
          where: { id: imageId },
          data: { position: index },
        })
      )
    );

    // Return updated images
    const images = await prisma.productImage.findMany({
      where: { productId: id },
      orderBy: { position: "asc" },
    });

    return apiSuccess(images);
  } catch {
    return apiError("Failed to reorder images", 500);
  }
}
