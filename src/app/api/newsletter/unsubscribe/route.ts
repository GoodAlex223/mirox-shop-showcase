import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { apiError, apiSuccess } from "@/lib/api-utils";
import { unsubscribeNewsletterSchema } from "@/lib/validations";
import { generateUnsubscribeToken } from "@/lib/newsletter";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const result = unsubscribeNewsletterSchema.safeParse(body);

    // `error`/`message` strings are for logs/API consumers; clients map
    // `code` to locale copy (newsletter.unsubscribe.byCode in messages/{uk,ru}.json).
    if (!result.success) {
      return apiError(result.error.issues[0].message, 400, "VALIDATION_ERROR");
    }

    const { email, token } = result.data;
    const normalizedEmail = email.toLowerCase().trim();

    const subscriber = await prisma.subscriber.findUnique({
      where: { email: normalizedEmail },
    });

    if (!subscriber) {
      return apiError("Subscriber not found", 404, "SUBSCRIBER_NOT_FOUND");
    }

    if (subscriber.status === "UNSUBSCRIBED") {
      return apiSuccess({ code: "ALREADY_UNSUBSCRIBED", message: "You are already unsubscribed" });
    }

    // Verify HMAC token matches
    const expectedToken = generateUnsubscribeToken(subscriber.id);
    if (token !== expectedToken) {
      return apiError("Invalid unsubscribe link", 400, "INVALID_UNSUBSCRIBE_LINK");
    }

    await prisma.subscriber.update({
      where: { id: subscriber.id },
      data: {
        status: "UNSUBSCRIBED",
        unsubscribedAt: new Date(),
      },
    });

    return apiSuccess({ code: "UNSUBSCRIBED", message: "You have been unsubscribed successfully" });
  } catch {
    return apiError("Failed to process unsubscribe", 500, "UNSUBSCRIBE_FAILED");
  }
}
