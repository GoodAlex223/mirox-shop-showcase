import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, apiError, apiSuccess } from "@/lib/api-utils";

// GET /api/reviews/eligibility?productId=xxx - Check if user can review a product
export async function GET(request: NextRequest) {
  const { error, session } = await requireAuth();
  if (error) return error;

  try {
    const productId = request.nextUrl.searchParams.get("productId");
    if (!productId) {
      return apiError("productId is required", 400);
    }

    const userId = session!.user!.id!;

    // Check for existing review
    const existingReview = await prisma.review.findUnique({
      where: { userId_productId: { userId, productId } },
      select: { id: true },
    });

    if (existingReview) {
      return apiSuccess({ canReview: false, hasExistingReview: true, orderId: null });
    }

    // Find a delivered order containing this product
    const eligibleOrder = await prisma.order.findFirst({
      where: {
        userId,
        status: "DELIVERED",
        items: { some: { productId } },
      },
      select: { id: true },
      orderBy: { createdAt: "desc" },
    });

    return apiSuccess({
      canReview: !!eligibleOrder,
      hasExistingReview: false,
      orderId: eligibleOrder?.id || null,
    });
  } catch {
    return apiError("Failed to check review eligibility", 500);
  }
}
