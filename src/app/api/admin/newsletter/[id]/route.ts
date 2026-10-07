import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, apiError, apiSuccess } from "@/lib/api-utils";
import { updateSubscriberStatusSchema } from "@/lib/validations";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// PATCH /api/admin/newsletter/[id] - Update subscriber status
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const { id } = await params;
    const body = await request.json();

    const result = updateSubscriberStatusSchema.safeParse(body);
    if (!result.success) {
      return apiError(result.error.issues[0].message, 400);
    }

    const subscriber = await prisma.subscriber.findUnique({ where: { id } });
    if (!subscriber) {
      return apiError("Subscriber not found", 404);
    }

    const updateData: Record<string, unknown> = { status: result.data.status };

    if (result.data.status === "ACTIVE" && subscriber.status !== "ACTIVE") {
      updateData.subscribedAt = new Date();
      updateData.unsubscribedAt = null;
      updateData.confirmationToken = null;
      updateData.confirmationExpiry = null;
    }

    if (result.data.status === "UNSUBSCRIBED" && subscriber.status !== "UNSUBSCRIBED") {
      updateData.unsubscribedAt = new Date();
    }

    const updated = await prisma.subscriber.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        status: true,
        subscribedAt: true,
        unsubscribedAt: true,
        createdAt: true,
      },
    });

    return apiSuccess(updated);
  } catch {
    return apiError("Failed to update subscriber", 500);
  }
}

// DELETE /api/admin/newsletter/[id] - Delete subscriber
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const { id } = await params;

    const subscriber = await prisma.subscriber.findUnique({ where: { id } });
    if (!subscriber) {
      return apiError("Subscriber not found", 404);
    }

    await prisma.subscriber.delete({ where: { id } });

    return apiSuccess({ message: "Subscriber deleted" });
  } catch {
    return apiError("Failed to delete subscriber", 500);
  }
}
