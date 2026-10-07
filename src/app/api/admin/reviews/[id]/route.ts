import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, apiError, apiSuccess } from "@/lib/api-utils";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/admin/reviews/[id] - Get single review detail
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const { id } = await params;

    const review = await prisma.review.findUnique({
      where: { id },
      select: {
        id: true,
        rating: true,
        comment: true,
        isHidden: true,
        adminReply: true,
        adminRepliedAt: true,
        createdAt: true,
        updatedAt: true,
        product: { select: { id: true, name: true, slug: true } },
        user: { select: { id: true, name: true, email: true } },
        order: { select: { id: true, orderNumber: true } },
      },
    });

    if (!review) {
      return apiError("Review not found", 404);
    }

    return apiSuccess(review);
  } catch {
    return apiError("Failed to fetch review", 500);
  }
}

// DELETE /api/admin/reviews/[id] - Permanently delete review
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const { id } = await params;

    const review = await prisma.review.findUnique({ where: { id } });
    if (!review) {
      return apiError("Review not found", 404);
    }

    await prisma.review.delete({ where: { id } });

    return apiSuccess({ message: "Review deleted successfully" });
  } catch {
    return apiError("Failed to delete review", 500);
  }
}
