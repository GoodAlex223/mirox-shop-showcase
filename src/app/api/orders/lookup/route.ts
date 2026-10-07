import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiError, apiSuccess } from "@/lib/api-utils";
import { orderLookupSchema } from "@/lib/validations";
import {
  LOOKUP_LOCK_MS,
  LOOKUP_MAX_FAILURES,
  emailsMatch,
  setOrderGrantCookie,
} from "@/lib/order-access";

// Guest order lookup (G18 spec §2). Public: the order-number + e-mail pair is
// the credential. Unknown number and wrong e-mail answer with the identical
// 404 body; what remains is a timing/side-effect difference (an unknown number
// costs one read, a known one one or two writes), recorded in the spec as an
// accepted residual and weaker than the 429 the lockout itself discloses. The
// per-order lockout is the only throttle here — per-IP limits belong to the
// platform layer.
export async function POST(request: NextRequest) {
  try {
    // A malformed body is the caller's error, not ours — 400, never a bare 500.
    const body = await request.json().catch(() => null);
    const parsed = orderLookupSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Invalid lookup data", 400, "VALIDATION_ERROR");
    }
    const { orderNumber, email } = parsed.data;

    const order = await prisma.order.findUnique({
      where: { orderNumber },
      select: { id: true, email: true, lookupFailedAttempts: true, lookupLockedUntil: true },
    });
    if (!order) {
      return apiError("Order not found", 404, "ORDER_NOT_FOUND");
    }

    const now = new Date();
    if (order.lookupLockedUntil && order.lookupLockedUntil > now) {
      return tooManyAttempts(Math.ceil((order.lookupLockedUntil.getTime() - now.getTime()) / 1000));
    }

    // Count the attempt BEFORE comparing, so a concurrent burst cannot all
    // compare against a pre-read counter (final review, G18). The lock
    // decision reads the RETURNED count, never the pre-read value.
    //
    // The lock writes below deliberately leave the counter alone: zeroing it
    // there would let siblings that pre-read the row before the lock landed
    // increment from 0 and reach the comparison — five more guesses per lock
    // cycle (code review, PR #44). The counter is reset here instead, when an
    // EXPIRED lock is observed, which opens the next window at 1.
    const attempt = await prisma.order.update({
      where: { id: order.id },
      data: order.lookupLockedUntil
        ? { lookupFailedAttempts: 1, lookupLockedUntil: null }
        : { lookupFailedAttempts: { increment: 1 } },
      select: { lookupFailedAttempts: true },
    });

    const lockedUntil = new Date(now.getTime() + LOOKUP_LOCK_MS);
    if (attempt.lookupFailedAttempts > LOOKUP_MAX_FAILURES) {
      // Past the cap without a lock on the pre-read row — only a concurrent
      // burst gets here. (Re)lock and refuse without comparing.
      await prisma.order.update({
        where: { id: order.id },
        data: { lookupLockedUntil: lockedUntil },
      });
      return tooManyAttempts(Math.ceil(LOOKUP_LOCK_MS / 1000));
    }

    if (!emailsMatch(order.email, email)) {
      if (attempt.lookupFailedAttempts >= LOOKUP_MAX_FAILURES) {
        await prisma.order.update({
          where: { id: order.id },
          data: { lookupLockedUntil: lockedUntil },
        });
      }
      return apiError("Order not found", 404, "ORDER_NOT_FOUND");
    }

    // Success: the attempt above counted this request, so always undo it and
    // clear any lock state.
    await prisma.order.update({
      where: { id: order.id },
      data: { lookupFailedAttempts: 0, lookupLockedUntil: null },
    });

    const response = apiSuccess({ orderNumber });
    setOrderGrantCookie(response, orderNumber, request);
    return response;
  } catch {
    return apiError("Lookup failed", 500, "LOOKUP_FAILED");
  }
}

// The 429 carries a Retry-After header and a machine-readable retryAfterSeconds,
// which apiError() cannot express — one builder keeps both 429 paths identical.
function tooManyAttempts(retryAfterSeconds: number) {
  return NextResponse.json(
    { error: "Too many attempts", code: "TOO_MANY_ATTEMPTS", retryAfterSeconds },
    { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
  );
}
