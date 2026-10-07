import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, apiError, apiSuccess } from "@/lib/api-utils";
import { adminReviewVisibilitySchema } from "@/lib/validations";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// PUT /api/admin/reviews/[id]/visibility - Toggle review visibility
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const { id } = await params;

    const review = await prisma.review.findUnique({ where: { id } });
    if (!review) {
      return apiError("Review not found", 404);
    }

    const body = await request.json();
    const validationResult = adminReviewVisibilitySchema.safeParse(body);
    if (!validationResult.success) {
      return apiError(validationResult.error.issues[0].message, 400);
    }

    const updated = await prisma.review.update({
      where: { id },
      data: { isHidden: validationResult.data.isHidden },
      select: {
        id: true,
        isHidden: true,
      },
    });

    return apiSuccess(updated);
  } catch {
    return apiError("Failed to update review visibility", 500);
  }
}
