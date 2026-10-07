import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { apiError, apiSuccess } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get("token");

    // `error`/`message` strings are for logs/API consumers; clients map
    // `code` to locale copy (newsletter.confirm.byCode in messages/{uk,ru}.json).
    if (!token) {
      return apiError("Confirmation token is required", 400, "TOKEN_REQUIRED");
    }

    const subscriber = await prisma.subscriber.findUnique({
      where: { confirmationToken: token },
    });

    if (!subscriber) {
      return apiError("Invalid confirmation link", 404, "INVALID_TOKEN");
    }

    if (subscriber.status === "ACTIVE") {
      return apiSuccess({
        code: "ALREADY_CONFIRMED",
        message: "Your subscription is already confirmed",
      });
    }

    if (!subscriber.confirmationExpiry || subscriber.confirmationExpiry < new Date()) {
      return apiError(
        "This confirmation link has expired. Please subscribe again.",
        410,
        "LINK_EXPIRED"
      );
    }

    await prisma.subscriber.update({
      where: { id: subscriber.id },
      data: {
        status: "ACTIVE",
        subscribedAt: new Date(),
        confirmationToken: null,
        confirmationExpiry: null,
      },
    });

    return apiSuccess({ code: "CONFIRMED", message: "Your subscription has been confirmed" });
  } catch {
    return apiError("Failed to confirm subscription", 500, "CONFIRM_FAILED");
  }
}
