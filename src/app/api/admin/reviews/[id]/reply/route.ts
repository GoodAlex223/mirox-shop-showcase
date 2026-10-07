import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, apiError, apiSuccess } from "@/lib/api-utils";
import { adminReviewReplySchema } from "@/lib/validations";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// PUT /api/admin/reviews/[id]/reply - Add or update admin reply
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
    const validationResult = adminReviewReplySchema.safeParse(body);
    if (!validationResult.success) {
      return apiError(validationResult.error.issues[0].message, 400);
    }

    const updated = await prisma.review.update({
      where: { id },
      data: {
        adminReply: validationResult.data.adminReply,
        adminRepliedAt: new Date(),
      },
      select: {
        id: true,
        adminReply: true,
        adminRepliedAt: true,
      },
    });

    return apiSuccess(updated);
  } catch {
    return apiError("Failed to update reply", 500);
  }
}

// DELETE /api/admin/reviews/[id]/reply - Remove admin reply
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const { id } = await params;

    const review = await prisma.review.findUnique({ where: { id } });
    if (!review) {
      return apiError("Review not found", 404);
    }

    const updated = await prisma.review.update({
      where: { id },
      data: {
        adminReply: null,
        adminRepliedAt: null,
      },
      select: {
        id: true,
        adminReply: true,
        adminRepliedAt: true,
      },
    });

    return apiSuccess(updated);
  } catch {
    return apiError("Failed to remove reply", 500);
  }
}
