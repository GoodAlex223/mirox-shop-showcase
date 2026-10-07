import crypto from "crypto";
import type { NextRequest, NextResponse } from "next/server";
import type { Session } from "next-auth";
import { ORDER_NUMBER_MAX_LENGTH, ORDER_NUMBER_PATTERN } from "@/lib/validations";

/**
 * Guest order access (G18 spec §1–§2).
 *
 * One rule, used by the confirmation page and /track/[orderNumber]: the
 * owning session may see the order; otherwise a valid grant cookie for that
 * exact order number may; otherwise nothing. The grant is a signed, expiring
 * cookie — stateless, one per order — set by create-order (post-checkout) and
 * by the lookup route (after an order-number + e-mail pair verifies).
 */

export const ORDER_GRANT_TTL_SECONDS = 24 * 60 * 60;
export const LOOKUP_MAX_FAILURES = 5;
export const LOOKUP_LOCK_MS = 15 * 60 * 1000;

export function normalizeOrderNumber(value: string): string {
  return value.trim().toUpperCase();
}

export function isValidOrderNumber(value: string): boolean {
  return value.length <= ORDER_NUMBER_MAX_LENGTH && ORDER_NUMBER_PATTERN.test(value);
}

export function orderGrantCookieName(orderNumber: string): string {
  return `og_${orderNumber}`;
}

function requireSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error("NEXTAUTH_SECRET is not set — order grants cannot be signed");
  }
  return secret;
}

function sign(orderNumber: string, expiry: number, secret: string): Buffer {
  return crypto
    .createHmac("sha256", secret)
    .update(`order-grant:${orderNumber}:${expiry}`)
    .digest();
}

function nowSeconds(now: Date): number {
  return Math.floor(now.getTime() / 1000);
}

export function createOrderGrant(orderNumber: string, now: Date = new Date()): string {
  const expiry = nowSeconds(now) + ORDER_GRANT_TTL_SECONDS;
  return `${expiry}.${sign(orderNumber, expiry, requireSecret()).toString("hex")}`;
}

/** Never throws — a missing secret or any malformed value reads as "no grant". */
export function verifyOrderGrant(
  orderNumber: string,
  cookieValue: string | undefined,
  now: Date = new Date()
): boolean {
  if (!cookieValue) return false;
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) return false;
  const dot = cookieValue.indexOf(".");
  if (dot <= 0 || dot === cookieValue.length - 1) return false;
  const expiry = Number(cookieValue.slice(0, dot));
  const givenHex = cookieValue.slice(dot + 1);
  if (!Number.isInteger(expiry) || expiry <= nowSeconds(now)) return false;
  if (!/^[0-9a-f]+$/.test(givenHex)) return false;
  const given = Buffer.from(givenHex, "hex");
  const expected = sign(orderNumber, expiry, secret);
  if (given.length !== expected.length) return false;
  return crypto.timingSafeEqual(given, expected);
}

export function setOrderGrantCookie(
  response: NextResponse,
  orderNumber: string,
  request: NextRequest
): void {
  response.cookies.set(orderGrantCookieName(orderNumber), createOrderGrant(orderNumber), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: ORDER_GRANT_TTL_SECONDS,
    // Mirrors NextAuth's useSecureCookies rule: Secure on https (Vercel),
    // plain on CI's http://localhost — WebKit drops Secure cookies there.
    secure: request.nextUrl.protocol === "https:",
  });
}

/**
 * Constant-time e-mail comparison over normalised digests, so differing
 * lengths never short-circuit. create-order stores the address as typed, so
 * both sides are normalised here rather than in the database.
 */
export function emailsMatch(stored: string, given: string): boolean {
  const digest = (v: string) => crypto.createHash("sha256").update(v.trim().toLowerCase()).digest();
  return crypto.timingSafeEqual(digest(stored), digest(given));
}

export function canAccessOrder<T extends { orderNumber: string; userId: string | null }>(
  order: T | null,
  session: Session | null,
  cookieValue: string | undefined,
  now: Date = new Date()
): order is T {
  if (!order) return false;
  if (order.userId && session?.user?.id === order.userId) return true;
  return verifyOrderGrant(order.orderNumber, cookieValue, now);
}
