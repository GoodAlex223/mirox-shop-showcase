import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-utils";
import { feedbackSchema } from "@/lib/validations";
import { sendFeedbackEmail } from "@/lib/email";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const result = feedbackSchema.safeParse(body);

    // `error`/`message` prose stays English for logs/API consumers; the
    // /feedback page maps `code` to locale copy (feedback.byCode in messages/{uk,ru}.json).
    if (!result.success) {
      return apiError(result.error.issues[0].message, 400, "VALIDATION_ERROR");
    }

    const { name, email, message, website } = result.data;

    // Honeypot: the field is visually hidden, so a value means a bot filled
    // it. Report success without sending so the bot gets no signal.
    if (website && website.trim() !== "") {
      return apiSuccess({ code: "FEEDBACK_SENT", message: "Feedback sent" }, 201);
    }

    // Awaited (PR #34): a fire-and-forget send dies at serverless freeze.
    // The email IS the deliverable, so a failed send must not report
    // success (deliberately stricter than the newsletter subscribe route).
    const sent = await sendFeedbackEmail({ name, email, message });
    if (!sent.success) {
      return apiError("Failed to send feedback", 500, "SEND_FAILED");
    }

    return apiSuccess({ code: "FEEDBACK_SENT", message: "Feedback sent" }, 201);
  } catch {
    return apiError("Failed to process feedback", 500, "SEND_FAILED");
  }
}
