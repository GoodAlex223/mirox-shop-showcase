import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { serializeJsonLd } from "@/lib/seo";
import { DISCOVERY_ARGS, gitLines } from "../helpers/discovery";

const REPO_ROOT = join(__dirname, "..", "..");

/**
 * Every source file that embeds an `application/ld+json` block, found rather
 * than listed. Uses git so build output and node_modules can never leak in.
 */
// PR #43 review round 2: discovery includes UNTRACKED (non-ignored) files.
// With tracked-only lookup the guard simply could not see a file the developer
// had not staged yet, and this repo's pre-commit hook runs lint-staged only —
// no hook runs the suite. So the false green did NOT end at `git commit`
// (round 3 corrected that): committing stayed green too, and the failure first
// surfaced on some later suite run after staging, or in CI. The gap was wider
// than "deferred to commit" — it was "deferred until something else happened
// to look".
//
// The --untracked flag is load-bearing: drop it and this gap silently reopens.
// tests/unit/discovery-untracked.test.ts pins it against a scratch repository.
function discoverJsonLdSites(): string[] {
  return gitLines(DISCOVERY_ARGS.jsonLd, REPO_ROOT);
}

// G17 / F2 (MEDIUM, 3/3 panel): customer-controlled review `comment` and
// `user.name` reach an inline <script type="application/ld+json"> through
// dangerouslySetInnerHTML. JSON.stringify escapes neither "<" nor "/", so a
// closing-script sequence in a review terminates the element and everything
// after it parses as HTML — stored XSS in the storefront origin, executing for
// any admin who opens the product page.

const CLOSE_SCRIPT = "</" + "script>";

describe("serializeJsonLd (G17 F2)", () => {
  it("escapes < so a review cannot close the script element", () => {
    const payload = { review: `${CLOSE_SCRIPT}<img src=x onerror=alert(1)>` };
    const out = serializeJsonLd(payload);

    expect(out).not.toContain("<");
    expect(out.toLowerCase()).not.toContain(CLOSE_SCRIPT);
    expect(out).toContain("\\u003c");
  });

  it("escapes > and & as well, so no HTML-significant character survives", () => {
    const out = serializeJsonLd({ v: "a > b && c < d" });
    expect(out).not.toContain(">");
    expect(out).not.toContain("&");
    expect(out).not.toContain("<");
  });

  it("escapes the U+2028/U+2029 separators that break inline script parsing", () => {
    const out = serializeJsonLd({ v: "a\u2028b\u2029c" });
    expect(out).not.toContain("\u2028");
    expect(out).not.toContain("\u2029");
    expect(out).toContain("\\u2028");
    expect(out).toContain("\\u2029");
  });

  it("stays valid JSON that round-trips to the original value", () => {
    // The escaping must not corrupt the structured data Google consumes.
    const payload = {
      "@type": "Product",
      name: `Худі ${CLOSE_SCRIPT} & <b>bold</b>`,
      review: [{ body: "5 & 6 < 7", author: "Мар'я" }],
      rating: 4.5,
      nested: { deep: ["<a>", "&amp;"] },
    };
    expect(JSON.parse(serializeJsonLd(payload))).toEqual(payload);
  });

  it("leaves ordinary content untouched apart from the escapes", () => {
    expect(JSON.parse(serializeJsonLd({ name: "Олімпійка Mirox" }))).toEqual({
      name: "Олімпійка Mirox",
    });
  });
});

describe("no JSON-LD site bypasses the serializer (G17 F2)", () => {
  // Structural guard: the fix is only durable if the NEXT ld+json block added
  // to the app also goes through serializeJsonLd. A bare JSON.stringify inside
  // dangerouslySetInnerHTML is the exact shape of the original bug.
  //
  // PR #43 review finding 6: this list used to be two hardcoded paths, which
  // meant a third ld+json block added anywhere else would not have failed
  // anything — while seo.ts's docstring promised the build WOULD fail. The set
  // is discovered now, so the promise is one the guard can actually keep. A
  // guard that cannot see a new call site is documentation, not a control.
  const FILES = discoverJsonLdSites();

  it("finds the ld+json sites rather than trusting a hardcoded list", () => {
    // Fails loudly if discovery silently matches nothing — an empty set would
    // make every assertion below vacuously pass, which is the failure mode
    // this whole describe block exists to prevent.
    expect(FILES.length).toBeGreaterThanOrEqual(2);
  });

  it.each(FILES)("%s passes no bare JSON.stringify to dangerouslySetInnerHTML", (file) => {
    const source = readFileSync(join(REPO_ROOT, file), "utf8");
    expect(source).not.toMatch(/__html:\s*JSON\.stringify\(/);
  });

  it.each(FILES)("%s serialises through serializeJsonLd", (file) => {
    const source = readFileSync(join(REPO_ROOT, file), "utf8");
    expect(source).toMatch(/serializeJsonLd/);
  });
});
