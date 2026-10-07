import { describe, it, expect } from "vitest";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore -- next.config.mjs is plain JS with no type declarations
import nextConfig from "../../next.config.mjs";

/**
 * G12 retired `/categories/[slug]`. The redirect deliberately lives in
 * next.config.mjs rather than as a page-level `redirect()` call: Next wraps
 * every route segment in a RedirectBoundary, so a `redirect()` thrown inside
 * a Server Component page is captured mid-stream and rendered as
 * `<meta http-equiv="refresh">` on a **200** — confirmed against a production
 * build during the G12 browser gate — instead of a real 3xx. A routing-layer
 * redirects() entry emits a genuine 307 before any rendering happens.
 *
 * This resolves the actual exported config (the one next-intl's plugin wraps
 * and Next reads at build time) and invokes redirects(), so it asserts
 * shipped behaviour rather than matching source text.
 */
describe("/categories/[slug] retirement redirect (G12)", () => {
  it("redirects the slug route to the catalog, temporarily (307)", async () => {
    const rules = await nextConfig.redirects();
    const rule = rules.find((r: { source: string }) => r.source === "/categories/:slug");

    expect(rule).toBeDefined();
    expect(rule.destination).toBe("/products?category=:slug");
    // permanent: false === 307. Not 308 — the URLs stay reclaimable for
    // future category landing pages (spec decision 6).
    expect(rule.permanent).toBe(false);
  });

  it("leaves the /categories index untouched", async () => {
    const rules = await nextConfig.redirects();
    // `:slug` is a required segment, so the bare index never matches — but
    // guard against anyone adding a broader `/categories/:path*` rule, which
    // would silently swallow the index page.
    const swallowsIndex = rules.some((r: { source: string }) =>
      /^\/categories(\/:[a-z]+\*|\/?$)/i.test(r.source)
    );
    expect(swallowsIndex).toBe(false);
  });
});
