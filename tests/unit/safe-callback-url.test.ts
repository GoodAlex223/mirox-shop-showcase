import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { safeCallbackUrl } from "@/lib/safe-redirect";

// G17 / F5 (MEDIUM, 3/3 panel): ?callbackUrl= was read from the query string and
// handed straight to router.push(). Next's app router treats a URL whose origin
// differs from window.location.origin as external and performs a full browser
// navigation, so a link to /login?callbackUrl=https://evil.tld sends the user to
// an attacker's page immediately after a genuine login on the real domain —
// exactly the credibility a phishing re-prompt needs.

describe("safeCallbackUrl (G17 F5)", () => {
  it("keeps ordinary in-app destinations", () => {
    expect(safeCallbackUrl("/account")).toBe("/account");
    expect(safeCallbackUrl("/account/orders?page=2")).toBe("/account/orders?page=2");
    expect(safeCallbackUrl("/products/hudi#reviews")).toBe("/products/hudi#reviews");
    expect(safeCallbackUrl("/")).toBe("/");
  });

  it("rejects absolute URLs to another origin", () => {
    expect(safeCallbackUrl("https://evil.tld/account")).toBe("/");
    expect(safeCallbackUrl("http://evil.tld")).toBe("/");
    expect(safeCallbackUrl("https://shop-example.evil.tld/account")).toBe("/");
  });

  it("rejects protocol-relative URLs, which browsers resolve as external", () => {
    // The classic bypass for a naive "must start with /" check.
    expect(safeCallbackUrl("//evil.tld")).toBe("/");
    expect(safeCallbackUrl("//evil.tld/account")).toBe("/");
  });

  it("rejects backslash-prefixed variants that some browsers normalise to //", () => {
    expect(safeCallbackUrl("/\\evil.tld")).toBe("/");
    expect(safeCallbackUrl("\\\\evil.tld")).toBe("/");
    expect(safeCallbackUrl("/\\/evil.tld")).toBe("/");
  });

  it("rejects non-http schemes", () => {
    expect(safeCallbackUrl("javascript:alert(1)")).toBe("/");
    expect(safeCallbackUrl("data:text/html,<script>alert(1)</script>")).toBe("/");
  });

  it("rejects anything that is not a rooted path", () => {
    expect(safeCallbackUrl("account")).toBe("/");
    expect(safeCallbackUrl("")).toBe("/");
    expect(safeCallbackUrl(null)).toBe("/");
    expect(safeCallbackUrl(undefined)).toBe("/");
  });

  it("ignores leading/trailing whitespace used to smuggle a scheme past a check", () => {
    expect(safeCallbackUrl("  https://evil.tld")).toBe("/");
    expect(safeCallbackUrl("\t//evil.tld")).toBe("/");
  });
});

describe("the login form uses the guard (G17 F5)", () => {
  it("does not push a raw callbackUrl", () => {
    const source = readFileSync(
      join(__dirname, "..", "..", "src/app/(auth)/login/login-form.tsx"),
      "utf8"
    );
    expect(source).toMatch(/safeCallbackUrl\(/);
    // The raw query value must not reach router.push directly.
    expect(source).not.toMatch(
      /const callbackUrl = searchParams\?\.get\("callbackUrl"\) \|\| "\/";/
    );
  });
});
