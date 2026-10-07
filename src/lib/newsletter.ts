import crypto from "crypto";

const TOKEN_EXPIRY_HOURS = 24;

export function generateConfirmationToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function getTokenExpiry(): Date {
  return new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);
}

export function getConfirmationUrl(token: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return `${baseUrl}/newsletter/confirm?token=${token}`;
}

/**
 * Generate a secure, deterministic unsubscribe token for a subscriber.
 * Uses HMAC-SHA256 with the app secret so tokens can't be forged.
 */
export function generateUnsubscribeToken(subscriberId: string): string {
  const secret = process.env.NEXTAUTH_SECRET || "development-secret";
  return crypto.createHmac("sha256", secret).update(subscriberId).digest("hex");
}

export function getUnsubscribeUrl(email: string, subscriberId: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const token = generateUnsubscribeToken(subscriberId);
  return `${baseUrl}/newsletter/unsubscribe?email=${encodeURIComponent(email)}&token=${token}`;
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
