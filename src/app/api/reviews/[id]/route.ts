import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, apiError, apiSuccess } from "@/lib/api-utils";
import { updateReviewSchema } from "@/lib/validations";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// PUT /api/reviews/[id] - Update own review
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const { error, session } = await requireAuth();
  if (error) return error;

  try {
    const { id } = await params;
    const userId = session!.user!.id!;

    const review = await prisma.review.findUnique({ where: { id } });
    if (!review) {
      return apiError("Review not found", 404);
    }

    if (review.userId !== userId) {
      return apiError("You can only edit your own reviews", 403);
    }

    const body = await request.json().catch(() => null);
    const validationResult = updateReviewSchema.safeParse(body);
    if (!validationResult.success) {
      return apiError(validationResult.error.issues[0].message, 400);
    }

    const data = validationResult.data;
    const updated = await prisma.review.update({
      where: { id },
      data: {
        ...(data.rating !== undefined && { rating: data.rating }),
        ...(data.comment !== undefined && { comment: data.comment || null }),
      },
      select: {
        id: true,
        rating: true,
        comment: true,
        createdAt: true,
        updatedAt: true,
        user: { select: { id: true, name: true, image: true } },
      },
    });

    return apiSuccess(updated);
  } catch {
    return apiError("Failed to update review", 500);
  }
}

// DELETE /api/reviews/[id] - Delete own review
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { error, session } = await requireAuth();
  if (error) return error;

  try {
    const { id } = await params;
    const userId = session!.user!.id!;

    const review = await prisma.review.findUnique({ where: { id } });
    if (!review) {
      return apiError("Review not found", 404);
    }

    if (review.userId !== userId) {
      return apiError("You can only delete your own reviews", 403);
    }

    await prisma.review.delete({ where: { id } });

    return apiSuccess({ message: "Review deleted successfully" });
  } catch {
    return apiError("Failed to delete review", 500);
  }
}
