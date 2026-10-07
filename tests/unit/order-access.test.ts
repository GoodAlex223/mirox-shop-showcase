import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import type { Session } from "next-auth";
import {
  ORDER_GRANT_TTL_SECONDS,
  canAccessOrder,
  createOrderGrant,
  emailsMatch,
  isValidOrderNumber,
  normalizeOrderNumber,
  orderGrantCookieName,
  setOrderGrantCookie,
  verifyOrderGrant,
} from "@/lib/order-access";
import { generateOrderNumber } from "@/lib/stripe";
import { ORDER_NUMBER_MAX_LENGTH } from "@/lib/validations";

const originalSecret = process.env.NEXTAUTH_SECRET;
const NOW = new Date("2026-09-04T12:00:00Z");
const ORDER = "ORD-MF2K1X9Q-A7B3";

beforeEach(() => {
  process.env.NEXTAUTH_SECRET = "test-secret-for-order-grants";
});
afterEach(() => {
  process.env.NEXTAUTH_SECRET = originalSecret;
});

function session(id: string): Session {
  return {
    user: { id, email: "c@example.com", name: null, image: null, role: "CUSTOMER" },
    expires: "",
  } as Session;
}

describe("order number gate", () => {
  it("normalises and accepts the generated shape", () => {
    expect(normalizeOrderNumber("  ord-mf2k1x9q-a7b3 ")).toBe(ORDER);
    expect(isValidOrderNumber(ORDER)).toBe(true);
    expect(isValidOrderNumber("ORD-TEST")).toBe(false); // the unit-test fixture shape is NOT a real order number
  });
  it("rejects lowercase, path-ish, empty and oversized input", () => {
    for (const bad of [
      "ord-mf2k1x9q-a7b3",
      "../ORD-MF2K1X9Q-A7B3",
      "",
      "ORD-MF2K1X9Q-A7B",
      "ORD-MF2K1X9Q-A7B3X",
      "ORD-MF2K1X9Q-A7B3; Path=/",
    ]) {
      expect(isValidOrderNumber(bad)).toBe(false);
    }
  });
  it("derives the cookie name from the order number", () => {
    expect(orderGrantCookieName(ORDER)).toBe(`og_${ORDER}`);
  });

  it("accepts every number the live generator emits (the gate and the generator are one contract)", () => {
    for (let i = 0; i < 1000; i++) {
      expect(isValidOrderNumber(generateOrderNumber())).toBe(true);
    }
  });

  it("caps the length at the lookup schema bound, so the page gate is no looser than the API gate", () => {
    expect(ORDER.length).toBeLessThanOrEqual(ORDER_NUMBER_MAX_LENGTH);
    expect(isValidOrderNumber(`ORD-${"A".repeat(ORDER_NUMBER_MAX_LENGTH)}-ABCD`)).toBe(false);
  });
});

describe("createOrderGrant / verifyOrderGrant", () => {
  it("round-trips a fresh grant", () => {
    const grant = createOrderGrant(ORDER, NOW);
    expect(grant).toMatch(/^\d+\.[0-9a-f]{64}$/);
    expect(verifyOrderGrant(ORDER, grant, NOW)).toBe(true);
  });
  it("expires exactly at the TTL", () => {
    const grant = createOrderGrant(ORDER, NOW);
    const justBefore = new Date(NOW.getTime() + (ORDER_GRANT_TTL_SECONDS - 1) * 1000);
    const at = new Date(NOW.getTime() + ORDER_GRANT_TTL_SECONDS * 1000);
    expect(verifyOrderGrant(ORDER, grant, justBefore)).toBe(true);
    expect(verifyOrderGrant(ORDER, grant, at)).toBe(false);
  });
  it("rejects a tampered signature, a tampered expiry, and a grant for another order", () => {
    const grant = createOrderGrant(ORDER, NOW);
    const [exp, sig] = grant.split(".");
    const flipped = (sig[0] === "0" ? "1" : "0") + sig.slice(1);
    expect(verifyOrderGrant(ORDER, `${exp}.${flipped}`, NOW)).toBe(false);
    expect(verifyOrderGrant(ORDER, `${Number(exp) + 3600}.${sig}`, NOW)).toBe(false);
    expect(verifyOrderGrant("ORD-MF2K1X9Q-ZZZZ", grant, NOW)).toBe(false);
  });
  it("rejects malformed values without throwing", () => {
    for (const bad of [undefined, "", "nodot", "abc.def", "123.", ".abc", "123.zz"]) {
      expect(verifyOrderGrant(ORDER, bad, NOW)).toBe(false);
    }
  });
  it("binds the grant to the secret", () => {
    const grant = createOrderGrant(ORDER, NOW);
    process.env.NEXTAUTH_SECRET = "another-secret";
    expect(verifyOrderGrant(ORDER, grant, NOW)).toBe(false);
  });
  it("throws on create and reads as no-grant on verify when the secret is unset", () => {
    const grant = createOrderGrant(ORDER, NOW);
    delete process.env.NEXTAUTH_SECRET;
    expect(() => createOrderGrant(ORDER, NOW)).toThrow(/NEXTAUTH_SECRET/);
    expect(verifyOrderGrant(ORDER, grant, NOW)).toBe(false);
  });
});

describe("setOrderGrantCookie", () => {
  it("sets an httpOnly lax path=/ cookie with the TTL, secure only over https", () => {
    const http = NextResponse.json({});
    setOrderGrantCookie(http, ORDER, new NextRequest("http://localhost:3000/api/orders/lookup"));
    const c = http.cookies.get(`og_${ORDER}`);
    expect(c).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: ORDER_GRANT_TTL_SECONDS,
    });
    expect(c?.secure).toBeFalsy();
    expect(verifyOrderGrant(ORDER, c?.value)).toBe(true);

    const https = NextResponse.json({});
    setOrderGrantCookie(
      https,
      ORDER,
      new NextRequest("https://shop.example.com/api/orders/lookup")
    );
    expect(https.cookies.get(`og_${ORDER}`)?.secure).toBe(true);
  });
});

describe("emailsMatch", () => {
  it("compares case- and whitespace-insensitively without mutating the stored value", () => {
    expect(emailsMatch("Guest@Example.com", "  guest@example.com ")).toBe(true);
    expect(emailsMatch("guest@example.com", "guest@example.co")).toBe(false);
    expect(emailsMatch("guest@example.com", "")).toBe(false);
  });
});

describe("canAccessOrder", () => {
  const order = { orderNumber: ORDER, userId: "user-1" };
  const guest = { orderNumber: ORDER, userId: null };
  it("allows the owning session", () => {
    expect(canAccessOrder(order, session("user-1"), undefined, NOW)).toBe(true);
  });
  it("allows a valid grant, for guests and for someone else's session alike", () => {
    const grant = createOrderGrant(ORDER, NOW);
    expect(canAccessOrder(guest, null, grant, NOW)).toBe(true);
    expect(canAccessOrder(order, session("user-2"), grant, NOW)).toBe(true);
  });
  it("denies a different user's session, a missing grant, and a foreign grant", () => {
    expect(canAccessOrder(order, session("user-2"), undefined, NOW)).toBe(false);
    expect(canAccessOrder(guest, null, undefined, NOW)).toBe(false);
    expect(canAccessOrder(guest, null, createOrderGrant("ORD-MF2K1X9Q-ZZZZ", NOW), NOW)).toBe(
      false
    );
  });
  it("never allows a null order, whatever the session or grant", () => {
    expect(canAccessOrder(null, session("user-1"), createOrderGrant(ORDER, NOW), NOW)).toBe(false);
  });
});
