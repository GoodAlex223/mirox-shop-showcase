import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { createNextRequest } from "../helpers/api-test-utils";

// api-utils.ts transitively imports next-auth via @/lib/auth — mock to keep
// vitest away from its ESM resolution.
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", () => ({
  prisma: { order: { findUnique: vi.fn(), update: vi.fn() } },
}));

import { POST } from "@/app/api/orders/lookup/route";
import { prisma } from "@/lib/db";
import { verifyOrderGrant, LOOKUP_MAX_FAILURES } from "@/lib/order-access";

const mockFindUnique = vi.mocked(prisma.order.findUnique);
const mockUpdate = vi.mocked(prisma.order.update);
const ORDER = "ORD-MF2K1X9Q-A7B3";
const originalSecret = process.env.NEXTAUTH_SECRET;

function lookup(body: Record<string, unknown>) {
  return createNextRequest({ url: "/api/orders/lookup", method: "POST", body });
}

function storedOrder(
  overrides: Partial<{
    email: string;
    lookupFailedAttempts: number;
    lookupLockedUntil: Date | null;
  }> = {}
) {
  return {
    id: "order-1",
    email: "Guest@Example.com",
    lookupFailedAttempts: 0,
    lookupLockedUntil: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  // clearAllMocks keeps queued mockResolvedValueOnce values; a test that
  // throws mid-route leaves one behind for the next test. Reset explicitly.
  mockUpdate.mockReset();
  process.env.NEXTAUTH_SECRET = "test-secret-for-order-grants";
  // The route counts the attempt before comparing (final review, G18), so the
  // FIRST update call is always the increment — its return value is what the
  // route's lock decision reads. Any later reset/lock write carries no
  // `increment`, so it falls through to the harmless default.
  mockUpdate.mockImplementation(async (args) => {
    const data = (args as { data?: { lookupFailedAttempts?: { increment?: number } } }).data;
    const v = data?.lookupFailedAttempts;
    return (
      typeof v === "number"
        ? { lookupFailedAttempts: v }
        : v?.increment
          ? { lookupFailedAttempts: 1 }
          : {}
    ) as never;
  });
});
afterEach(() => {
  process.env.NEXTAUTH_SECRET = originalSecret;
});

describe("POST /api/orders/lookup", () => {
  it("returns 400 VALIDATION_ERROR for a malformed order number", async () => {
    const res = await POST(lookup({ orderNumber: "not-an-order", email: "guest@example.com" }));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("VALIDATION_ERROR");
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it("returns 400 VALIDATION_ERROR for a malformed JSON body, not a 500", async () => {
    const req = new NextRequest("http://localhost:3000/api/orders/lookup", {
      method: "POST",
      body: "{not json",
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("VALIDATION_ERROR");
  });

  it("returns 404 ORDER_NOT_FOUND for an unknown order number", async () => {
    mockFindUnique.mockResolvedValue(null);
    const res = await POST(lookup({ orderNumber: ORDER, email: "guest@example.com" }));
    expect(res.status).toBe(404);
    expect((await res.json()).code).toBe("ORDER_NOT_FOUND");
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("returns the identical 404 for a wrong e-mail, counting the attempt before comparing", async () => {
    mockFindUnique.mockResolvedValue(storedOrder() as never);
    mockUpdate.mockResolvedValue({ lookupFailedAttempts: 1 } as never);
    const res = await POST(lookup({ orderNumber: ORDER, email: "wrong@example.com" }));
    expect(res.status).toBe(404);
    expect((await res.json()).code).toBe("ORDER_NOT_FOUND");
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "order-1" },
        data: { lookupFailedAttempts: { increment: 1 } },
      })
    );
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("locks the order for 15 minutes on the fifth failure without zeroing the counter", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-04T12:00:00Z"));
    try {
      mockFindUnique.mockResolvedValue(
        storedOrder({ lookupFailedAttempts: LOOKUP_MAX_FAILURES - 1 }) as never
      );
      mockUpdate
        .mockResolvedValueOnce({ lookupFailedAttempts: LOOKUP_MAX_FAILURES } as never)
        .mockResolvedValueOnce({} as never);
      const res = await POST(lookup({ orderNumber: ORDER, email: "wrong@example.com" }));
      expect(res.status).toBe(404);
      expect(mockUpdate).toHaveBeenCalledTimes(2);
      expect(mockUpdate).toHaveBeenLastCalledWith(
        expect.objectContaining({
          where: { id: "order-1" },
          data: {
            lookupLockedUntil: new Date("2026-09-04T12:15:00Z"),
          },
        })
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("answers 429 without comparing when a concurrent burst has pushed the count past the cap", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-04T12:00:00Z"));
    try {
      // Interleaving (code review, PR #44): this request pre-read the row at
      // the cap with no lock yet — the sibling that hit the cap is writing its
      // lock right now. Because that lock write leaves the counter alone, this
      // increment lands past the cap and is refused without a comparison. Were
      // the lock to zero the counter, this increment would return 1 and the
      // comparison would run — five more guesses per lock cycle.
      mockFindUnique.mockResolvedValue(
        storedOrder({ lookupFailedAttempts: LOOKUP_MAX_FAILURES }) as never
      );
      mockUpdate
        .mockResolvedValueOnce({ lookupFailedAttempts: LOOKUP_MAX_FAILURES + 1 } as never)
        .mockResolvedValueOnce({} as never);
      // The correct e-mail: a genuine burst must never reach the comparison.
      const res = await POST(lookup({ orderNumber: ORDER, email: "guest@example.com" }));
      expect(res.status).toBe(429);
      const json = await res.json();
      expect(json.code).toBe("TOO_MANY_ATTEMPTS");
      expect(json.retryAfterSeconds).toBe(900);
      expect(res.headers.get("retry-after")).toBe("900");
      expect(mockUpdate).toHaveBeenCalledTimes(2);
      expect(mockUpdate).toHaveBeenLastCalledWith(
        expect.objectContaining({
          where: { id: "order-1" },
          data: {
            lookupLockedUntil: new Date("2026-09-04T12:15:00Z"),
          },
        })
      );
      expect(res.headers.get("set-cookie")).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("returns 429 TOO_MANY_ATTEMPTS with Retry-After while locked, even for the right e-mail", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-04T12:00:00Z"));
    try {
      mockFindUnique.mockResolvedValue(
        storedOrder({ lookupLockedUntil: new Date("2026-09-04T12:10:00Z") }) as never
      );
      const res = await POST(lookup({ orderNumber: ORDER, email: "guest@example.com" }));
      expect(res.status).toBe(429);
      const json = await res.json();
      expect(json.code).toBe("TOO_MANY_ATTEMPTS");
      expect(json.retryAfterSeconds).toBe(600);
      expect(res.headers.get("retry-after")).toBe("600");
      expect(mockUpdate).not.toHaveBeenCalled();
      expect(res.headers.get("set-cookie")).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("treats an expired lock as no lock: the first attempt opens a new window at 1", async () => {
    // The lock write keeps the counter, so the reset has to happen here, when
    // an expired lock is observed — otherwise every attempt after expiry would
    // land past the cap and re-lock the order forever.
    mockFindUnique.mockResolvedValue(
      storedOrder({
        lookupFailedAttempts: LOOKUP_MAX_FAILURES,
        lookupLockedUntil: new Date(Date.now() - 1000),
      }) as never
    );
    const res = await POST(lookup({ orderNumber: ORDER, email: "guest@example.com" }));
    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: { id: "order-1" },
        data: { lookupFailedAttempts: 1, lookupLockedUntil: null },
      })
    );
    expect(mockUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { id: "order-1" },
        data: { lookupFailedAttempts: 0, lookupLockedUntil: null },
      })
    );
  });

  it("returns 200 with the grant cookie on a match, normalising case and whitespace on both sides", async () => {
    mockFindUnique.mockResolvedValue(storedOrder({ lookupFailedAttempts: 2 }) as never);
    const res = await POST(
      lookup({ orderNumber: `  ${ORDER.toLowerCase()} `, email: "  GUEST@example.com " })
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ orderNumber: ORDER });
    expect(mockFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { orderNumber: ORDER } })
    );
    // counter + lock reset because the stored row had failures
    expect(mockUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { id: "order-1" },
        data: { lookupFailedAttempts: 0, lookupLockedUntil: null },
      })
    );
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toMatch(new RegExp(`^og_${ORDER}=`));
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/SameSite=Lax/i);
    expect(setCookie).toMatch(/Path=\//);
    expect(setCookie).toMatch(/Max-Age=86400/);
    expect(setCookie).not.toMatch(/Secure/i); // http test request
    const value = res.cookies.get(`og_${ORDER}`)?.value;
    expect(verifyOrderGrant(ORDER, value)).toBe(true);
  });

  it("always counts the attempt and then resets it on success", async () => {
    mockFindUnique.mockResolvedValue(storedOrder() as never);
    const res = await POST(lookup({ orderNumber: ORDER, email: "guest@example.com" }));
    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledTimes(2);
    expect(mockUpdate).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: { id: "order-1" },
        data: { lookupFailedAttempts: { increment: 1 } },
      })
    );
    expect(mockUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { id: "order-1" },
        data: { lookupFailedAttempts: 0, lookupLockedUntil: null },
      })
    );
  });

  it("returns 500 LOOKUP_FAILED when the database throws", async () => {
    mockFindUnique.mockRejectedValue(new Error("db down"));
    const res = await POST(lookup({ orderNumber: ORDER, email: "guest@example.com" }));
    expect(res.status).toBe(500);
    expect((await res.json()).code).toBe("LOOKUP_FAILED");
  });
});
