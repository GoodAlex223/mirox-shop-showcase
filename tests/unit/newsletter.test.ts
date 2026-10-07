import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Store original env values
const originalEnv = { ...process.env };

beforeEach(() => {
  process.env.NEXT_PUBLIC_APP_URL = "https://test.example.com";
  process.env.NEXTAUTH_SECRET = "test-secret-key";
});

afterEach(() => {
  process.env.NEXT_PUBLIC_APP_URL = originalEnv.NEXT_PUBLIC_APP_URL;
  process.env.NEXTAUTH_SECRET = originalEnv.NEXTAUTH_SECRET;
  vi.restoreAllMocks();
});

import {
  generateConfirmationToken,
  getTokenExpiry,
  getConfirmationUrl,
  generateUnsubscribeToken,
  getUnsubscribeUrl,
  escapeHtml,
} from "@/lib/newsletter";

// ---------------------------------------------------------------------------
// Token generation
// ---------------------------------------------------------------------------

describe("generateConfirmationToken", () => {
  it("generates a 64-character hex string", () => {
    const token = generateConfirmationToken();

    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it("generates unique tokens on repeated calls", () => {
    const tokens = new Set(Array.from({ length: 10 }, () => generateConfirmationToken()));
    expect(tokens.size).toBe(10);
  });
});

describe("getTokenExpiry", () => {
  it("returns a date 24 hours in the future", () => {
    const before = Date.now();
    const expiry = getTokenExpiry();
    const after = Date.now();

    const twentyFourHoursMs = 24 * 60 * 60 * 1000;
    expect(expiry.getTime()).toBeGreaterThanOrEqual(before + twentyFourHoursMs);
    expect(expiry.getTime()).toBeLessThanOrEqual(after + twentyFourHoursMs);
  });
});

// ---------------------------------------------------------------------------
// URL builders
// ---------------------------------------------------------------------------

describe("getConfirmationUrl", () => {
  it("constructs URL with token query parameter", () => {
    const url = getConfirmationUrl("abc123");
    expect(url).toBe("https://test.example.com/newsletter/confirm?token=abc123");
  });

  it("falls back to localhost when env not set", () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    // Re-import to pick up env change - but since the module is already loaded,
    // the function reads process.env at call time
    const url = getConfirmationUrl("token");
    expect(url).toContain("/newsletter/confirm?token=token");
  });
});

describe("getUnsubscribeUrl", () => {
  it("constructs URL with encoded email and HMAC token", () => {
    const url = getUnsubscribeUrl("user@test.com", "sub-123");

    expect(url).toContain("https://test.example.com/newsletter/unsubscribe?email=");
    expect(url).toContain(encodeURIComponent("user@test.com"));
    expect(url).toContain("&token=");
  });

  it("encodes special characters in email", () => {
    const url = getUnsubscribeUrl("user+tag@test.com", "sub-123");
    expect(url).toContain(encodeURIComponent("user+tag@test.com"));
  });
});

// ---------------------------------------------------------------------------
// HMAC token generation
// ---------------------------------------------------------------------------

describe("generateUnsubscribeToken", () => {
  it("generates a hex string", () => {
    const token = generateUnsubscribeToken("sub-123");
    expect(token).toMatch(/^[0-9a-f]+$/);
  });

  it("is deterministic for the same subscriber ID", () => {
    const token1 = generateUnsubscribeToken("sub-123");
    const token2 = generateUnsubscribeToken("sub-123");
    expect(token1).toBe(token2);
  });

  it("produces different tokens for different subscriber IDs", () => {
    const token1 = generateUnsubscribeToken("sub-123");
    const token2 = generateUnsubscribeToken("sub-456");
    expect(token1).not.toBe(token2);
  });

  it("produces different tokens with different secrets", () => {
    const token1 = generateUnsubscribeToken("sub-123");

    process.env.NEXTAUTH_SECRET = "different-secret";
    const token2 = generateUnsubscribeToken("sub-123");

    expect(token1).not.toBe(token2);
  });
});

// ---------------------------------------------------------------------------
// HTML escaping
// ---------------------------------------------------------------------------

describe("escapeHtml", () => {
  it("escapes ampersand", () => {
    expect(escapeHtml("a & b")).toBe("a &amp; b");
  });

  it("escapes angle brackets", () => {
    expect(escapeHtml("<script>alert(1)</script>")).toBe("&lt;script&gt;alert(1)&lt;/script&gt;");
  });

  it("escapes double quotes", () => {
    expect(escapeHtml('say "hello"')).toBe("say &quot;hello&quot;");
  });

  it("escapes single quotes", () => {
    expect(escapeHtml("it's")).toBe("it&#039;s");
  });

  it("returns unchanged text without special characters", () => {
    expect(escapeHtml("hello world 123")).toBe("hello world 123");
  });

  it("handles empty string", () => {
    expect(escapeHtml("")).toBe("");
  });

  it("escapes all special characters together", () => {
    expect(escapeHtml("<a href=\"x\" & 'y'>")).toBe(
      "&lt;a href=&quot;x&quot; &amp; &#039;y&#039;&gt;"
    );
  });
});
