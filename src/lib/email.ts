import { Resend } from "resend";
import { emails } from "@/content/emails";
import { generateNewsletterConfirmationHtml } from "./email-templates/newsletter-confirmation";
import {
  generateOrderConfirmationHtml,
  type OrderEmailData,
} from "./email-templates/order-confirmation";
import { generateFeedbackEmailHtml, type FeedbackEmailData } from "./email-templates/feedback";

const resendApiKey = process.env.RESEND_API_KEY;
const emailFrom = process.env.EMAIL_FROM || "noreply@yourdomain.com";

// Create a mock resend for development when no API key is set
const resend = resendApiKey ? new Resend(resendApiKey) : null;

// The sends are awaited on the checkout/subscribe critical paths (PR #34 —
// an unawaited send dies at serverless freeze), so a stalled upstream must
// not hang the user's response for the platform's full timeout. The resend
// SDK (6.x) exposes no per-request abort, hence the race.
const SEND_TIMEOUT_MS = 10_000;

async function sendWithTimeout(
  send: Promise<{ error: { message: string } | null }>
): Promise<{ error: { message: string } | null }> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      send,
      new Promise<{ error: { message: string } }>((resolve) => {
        timer = setTimeout(
          () => resolve({ error: { message: `Email send timed out after ${SEND_TIMEOUT_MS}ms` } }),
          SEND_TIMEOUT_MS
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export type { OrderEmailData };
export type { FeedbackEmailData };

export async function sendOrderConfirmationEmail(
  data: OrderEmailData
): Promise<{ success: boolean; error?: string }> {
  // Skip sending in development if no API key
  if (!resend) {
    console.log("Skipping email send - RESEND_API_KEY not configured");
    console.log("Would send order confirmation to:", data.email);
    return { success: true };
  }

  try {
    const { error } = await sendWithTimeout(
      resend.emails.send({
        from: emailFrom,
        to: data.email,
        subject: emails.order.subject(data.orderNumber),
        html: generateOrderConfirmationHtml(data),
      })
    );

    if (error) {
      console.error("Failed to send order confirmation email:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error("Error sending order confirmation email:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function sendNewsletterConfirmationEmail(data: {
  email: string;
  confirmationUrl: string;
  unsubscribeUrl?: string;
}): Promise<{ success: boolean; error?: string }> {
  if (!resend) {
    console.log("Skipping email send - RESEND_API_KEY not configured");
    console.log("Would send newsletter confirmation to:", data.email);
    console.log("Confirmation URL:", data.confirmationUrl);
    return { success: true };
  }

  try {
    const { error } = await sendWithTimeout(
      resend.emails.send({
        from: emailFrom,
        to: data.email,
        subject: emails.newsletter.subject(),
        html: generateNewsletterConfirmationHtml(data),
      })
    );

    if (error) {
      console.error("Failed to send newsletter confirmation email:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error("Error sending newsletter confirmation email:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function sendFeedbackEmail(
  data: FeedbackEmailData
): Promise<{ success: boolean; error?: string }> {
  if (!resend) {
    console.log("Skipping email send - RESEND_API_KEY not configured");
    console.log("Would send feedback to:", process.env.FEEDBACK_EMAIL || "(FEEDBACK_EMAIL unset)");
    return { success: true };
  }

  // Read at call time, not module scope: a missing value must fail loud per
  // request (the email IS the deliverable), and env-dependent tests stay
  // honest (G5 getStoreName lesson).
  const to = process.env.FEEDBACK_EMAIL;
  if (!to) {
    console.error("FEEDBACK_EMAIL is not configured - feedback email not sent");
    return { success: false, error: "FEEDBACK_EMAIL not configured" };
  }

  try {
    const { error } = await sendWithTimeout(
      resend.emails.send({
        from: emailFrom,
        to,
        ...(data.email ? { replyTo: data.email } : {}),
        subject: emails.feedback.subject(),
        html: generateFeedbackEmailHtml(data),
      })
    );

    if (error) {
      console.error("Failed to send feedback email:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error("Error sending feedback email:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
