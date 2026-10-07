import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { apiError, apiSuccess } from "@/lib/api-utils";
import { subscribeNewsletterSchema } from "@/lib/validations";
import { Prisma } from "@prisma/client";
import {
  generateConfirmationToken,
  getTokenExpiry,
  getConfirmationUrl,
  getUnsubscribeUrl,
} from "@/lib/newsletter";
import { sendNewsletterConfirmationEmail } from "@/lib/email";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const result = subscribeNewsletterSchema.safeParse(body);

    // `error`/`message` strings are for logs/API consumers; clients map
    // `code` to locale copy (newsletter.signup.byCode in messages/{uk,ru}.json).
    if (!result.success) {
      return apiError(result.error.issues[0].message, 400, "VALIDATION_ERROR");
    }

    const { email } = result.data;
    const normalizedEmail = email.toLowerCase().trim();

    const existing = await prisma.subscriber.findUnique({
      where: { email: normalizedEmail },
    });

    if (existing?.status === "ACTIVE") {
      return apiError("This email is already subscribed", 409, "ALREADY_SUBSCRIBED");
    }

    const token = generateConfirmationToken();
    const expiry = getTokenExpiry();

    let subscriberId: string;

    if (existing) {
      // Re-subscribe: update token and reset to PENDING
      await prisma.subscriber.update({
        where: { id: existing.id },
        data: {
          status: "PENDING",
          confirmationToken: token,
          confirmationExpiry: expiry,
          unsubscribedAt: null,
        },
      });
      subscriberId = existing.id;
    } else {
      try {
        const created = await prisma.subscriber.create({
          data: {
            email: normalizedEmail,
            confirmationToken: token,
            confirmationExpiry: expiry,
          },
        });
        subscriberId = created.id;
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
          // Race condition: another request created the subscriber between our check and insert
          // Fetch the existing record and send confirmation using its token
          const raceExisting = await prisma.subscriber.findUnique({
            where: { email: normalizedEmail },
          });
          if (raceExisting?.confirmationToken && raceExisting.status === "PENDING") {
            const raceConfirmUrl = getConfirmationUrl(raceExisting.confirmationToken);
            const raceUnsubUrl = getUnsubscribeUrl(normalizedEmail, raceExisting.id);
            await sendNewsletterConfirmationEmail({
              email: normalizedEmail,
              confirmationUrl: raceConfirmUrl,
              unsubscribeUrl: raceUnsubUrl,
            });
          }
          return apiSuccess(
            {
              code: "CONFIRMATION_PENDING",
              message: "Please check your email to confirm your subscription",
            },
            201
          );
        }
        throw err;
      }
    }

    const confirmationUrl = getConfirmationUrl(token);
    const unsubscribeUrl = getUnsubscribeUrl(normalizedEmail, subscriberId);
    await sendNewsletterConfirmationEmail({
      email: normalizedEmail,
      confirmationUrl,
      unsubscribeUrl,
    });

    return apiSuccess(
      {
        code: "CONFIRMATION_PENDING",
        message: "Please check your email to confirm your subscription",
      },
      201
    );
  } catch {
    return apiError("Failed to process subscription", 500, "SUBSCRIBE_FAILED");
  }
}
