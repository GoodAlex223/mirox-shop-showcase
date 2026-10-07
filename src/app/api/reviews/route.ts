import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAuth, apiError, apiSuccess } from "@/lib/api-utils";
import { createReviewSchema } from "@/lib/validations";

// POST /api/reviews - Create a new review (verified purchase required)
export async function POST(request: NextRequest) {
  const { error, session } = await requireAuth();
  if (error) return error;

  try {
    const body = await request.json().catch(() => null);
    const validationResult = createReviewSchema.safeParse(body);
    if (!validationResult.success) {
      return apiError(validationResult.error.issues[0].message, 400);
    }

    const { productId, orderId, rating, comment } = validationResult.data;
    const userId = session!.user!.id!;

    // Verify order exists, belongs to user, contains this product, and is delivered
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        userId: true,
        status: true,
        items: {
          where: { productId },
          select: { id: true },
        },
      },
    });

    if (!order) {
      return apiError("Order not found", 404);
    }

    if (order.userId !== userId) {
      return apiError("You can only review products from your own orders", 403);
    }

    if (order.status !== "DELIVERED") {
      return apiError("You can only review products from delivered orders", 400);
    }

    if (order.items.length === 0) {
      return apiError("This order does not contain the specified product", 400);
    }

    // Check for existing review (unique constraint)
    const existingReview = await prisma.review.findUnique({
      where: { userId_productId: { userId, productId } },
    });

    if (existingReview) {
      return apiError("You have already reviewed this product", 409);
    }

    const review = await prisma.review.create({
      data: {
        productId,
        userId,
        orderId,
        rating,
        comment: comment || null,
      },
      select: {
        id: true,
        rating: true,
        comment: true,
        createdAt: true,
        user: { select: { id: true, name: true, image: true } },
      },
    });

    return apiSuccess(review, 201);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return apiError("You have already reviewed this product", 409);
    }
    return apiError("Failed to create review", 500);
  }
}
