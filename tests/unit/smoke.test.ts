import { describe, it, expect } from "vitest";
import {
  extractCssHashes,
  extractProductSlugs,
  findRemoteImageUrl,
  compareBaseline,
  stalenessPasses,
  readBaselineFor,
  mergeState,
  assertStatus,
  assertHomepage,
  assertProductsApi,
  assertHealth,
  assertNpCities,
  assertNpCitiesFresh,
  NP_KYIV_CITY_REF,
  assertCategoryRedirect,
  assertFeed,
  countFeedItems,
  buildLookalikeUrl,
  exitCodeFor,
} from "../../scripts/smoke-lib";

const ORIGIN = "https://shop.example";

describe("extractCssHashes", () => {
  it("collects, de-duplicates and sorts chunk hashes", () => {
    const html = `
      <link rel="preload" as="style" href="/_next/static/css/1ee63df177967359.css"/>
      <link rel="stylesheet" href="/_next/static/css/1ee63df177967359.css"/>
      <link rel="stylesheet" href="/_next/static/css/143491e5ab2efd5e.css"/>
    `;
    expect(extractCssHashes(html)).toEqual(["143491e5ab2efd5e", "1ee63df177967359"]);
  });

  it("returns an empty array when no stylesheet is linked", () => {
    expect(extractCssHashes("<html><body>no css</body></html>")).toEqual([]);
  });
});

describe("extractProductSlugs", () => {
  it("finds product links in server-rendered HTML", () => {
    const html = `<a href="/products/hudi-mirox-basic">H</a><a href="/products/futbolka-mirox">F</a>`;
    expect(extractProductSlugs(html)).toEqual(["futbolka-mirox", "hudi-mirox-basic"]);
  });

  // The real chunk path the catalog page ships. Counting it as a product would
  // make the homepage's DB-backed assertion pass on a page with no products at
  // all. Note what actually rejects it: PRODUCT_SLUG_RE's lookahead, because
  // `.js` follows the segment. This case passes with or without the /_next
  // strip — it guards the observed input, not the strip.
  it("ignores the catalog page's real /_next chunk path", () => {
    const html = `<script src="/_next/static/chunks/app/(shop)/products/page-9a0c2f2d3d5cd602.js"></script>`;
    expect(extractProductSlugs(html)).toEqual([]);
  });

  // The negative control for the /_next strip itself: `/products/hero-banner`
  // is followed by `/`, which IS in the lookahead set, so the lookahead lets it
  // through and only the strip stops it. Delete the strip and this test fails
  // with ["hero-banner"] — which is the whole point of having it.
  it("ignores a /_next asset path whose /products/ segment ends in a delimiter", () => {
    const html = `<link rel="preload" as="image" href="/_next/static/media/products/hero-banner/1x.avif" />`;
    expect(extractProductSlugs(html)).toEqual([]);
  });
});

describe("findRemoteImageUrl", () => {
  it("decodes the first absolute remote image behind /_next/image", () => {
    const html = `<img srcset="/_next/image?url=https%3A%2F%2Fpub-abc.r2.dev%2Fproducts%2Fa.jpg&amp;w=256&amp;q=75 256w"/>`;
    expect(findRemoteImageUrl(html, ORIGIN)).toBe("https://pub-abc.r2.dev/products/a.jpg");
  });

  it("returns null when every optimised image is root-relative", () => {
    const html = `<img src="/_next/image?url=%2Fimages%2Flogo.png&amp;w=128&amp;q=75"/>`;
    expect(findRemoteImageUrl(html, ORIGIN)).toBeNull();
  });

  it("skips images served from the target's own host", () => {
    const html = `<img src="/_next/image?url=https%3A%2F%2Fshop.example%2Fa.jpg&amp;w=128&amp;q=75"/>`;
    expect(findRemoteImageUrl(html, ORIGIN)).toBeNull();
  });
});

describe("compareBaseline", () => {
  it("reports CHANGED when the hash set differs", () => {
    expect(compareBaseline(["b", "c"], ["a", "b"])).toBe("CHANGED");
  });

  it("reports UNCHANGED for the same set regardless of order", () => {
    expect(compareBaseline(["b", "a"], ["a", "b"])).toBe("UNCHANGED");
  });

  it("reports NO-BASELINE for a missing or empty stored set", () => {
    expect(compareBaseline(["a"], null)).toBe("NO-BASELINE");
    expect(compareBaseline(["a"], [])).toBe("NO-BASELINE");
  });

  // An empty observed set must never reach the "sets differ → CHANGED" branch:
  // a site serving no CSS would otherwise report a passing, changed deploy.
  it("reports NO-CSS when the page served no stylesheet at all", () => {
    expect(compareBaseline([], ["a", "b"])).toBe("NO-CSS");
    expect(compareBaseline([], null)).toBe("NO-CSS");
  });
});

describe("stalenessPasses", () => {
  it("passes only on CHANGED by default", () => {
    expect(stalenessPasses("CHANGED", false)).toBe(true);
    expect(stalenessPasses("UNCHANGED", false)).toBe(false);
    expect(stalenessPasses("NO-BASELINE", false)).toBe(false);
  });

  it("lets NO-BASELINE pass only when explicitly allowed, and never UNCHANGED", () => {
    expect(stalenessPasses("NO-BASELINE", true)).toBe(true);
    expect(stalenessPasses("UNCHANGED", true)).toBe(false);
  });

  it("never passes NO-CSS, with or without --allow-missing-baseline", () => {
    expect(stalenessPasses("NO-CSS", false)).toBe(false);
    expect(stalenessPasses("NO-CSS", true)).toBe(false);
  });
});

describe("state file", () => {
  it("keys baselines by origin so a preview run cannot clobber production", () => {
    const prod = "https://shop.example";
    const preview = "https://preview-abc.vercel.app";
    let state = mergeState({}, prod, ["aaa"], "2026-09-10T00:00:00.000Z");
    state = mergeState(state, preview, ["zzz"], "2026-09-10T01:00:00.000Z");

    expect(readBaselineFor(state, prod)).toEqual(["aaa"]);
    expect(readBaselineFor(state, preview)).toEqual(["zzz"]);
  });

  it("returns null for an origin the state file has never seen", () => {
    expect(readBaselineFor({}, "https://shop.example")).toBeNull();
  });

  it("stores hashes sorted so ordering churn never reads as CHANGED", () => {
    const state = mergeState({}, "https://shop.example", ["b", "a"], "2026-09-10T00:00:00.000Z");
    expect(state["https://shop.example"].cssHashes).toEqual(["a", "b"]);
  });
});

function res(
  status: number,
  body = "",
  headers: Record<string, string> = {}
): { status: number; headers: Record<string, string>; body: string } {
  return { status, body, headers };
}

describe("assertStatus", () => {
  it("passes on the expected status and fails otherwise", () => {
    expect(assertStatus(200)(res(200)).status).toBe("pass");
    expect(assertStatus(200)(res(500)).status).toBe("fail");
    expect(assertStatus(400)(res(200)).detail).toContain("expected 400, got 200");
  });
});

describe("assertHomepage", () => {
  it("passes when the server HTML carries a product link", () => {
    expect(assertHomepage(res(200, `<a href="/products/futbolka-mirox">F</a>`)).status).toBe(
      "pass"
    );
  });

  it("fails on 200 with no product link — a rendered but DB-empty homepage", () => {
    const result = assertHomepage(res(200, "<html><body>Mirox</body></html>"));
    expect(result.status).toBe("fail");
    expect(result.detail).toContain("no /products/<slug>");
  });

  it("fails on a non-200", () => {
    expect(assertHomepage(res(500)).status).toBe("fail");
  });
});

describe("assertProductsApi", () => {
  it("passes when data[0].slug is a non-empty string", () => {
    expect(assertProductsApi(res(200, JSON.stringify({ data: [{ slug: "x" }] }))).status).toBe(
      "pass"
    );
  });

  it("fails on an empty data array", () => {
    expect(assertProductsApi(res(200, JSON.stringify({ data: [] }))).status).toBe("fail");
  });

  it("fails when the body is not JSON", () => {
    expect(assertProductsApi(res(200, "<html>")).detail).toContain("not JSON");
  });
});

describe("assertHealth", () => {
  it("passes only when checks.database.status is ok", () => {
    const ok = JSON.stringify({ checks: { database: { status: "ok" } } });
    const bad = JSON.stringify({ checks: { database: { status: "error" } } });
    expect(assertHealth(res(200, ok)).status).toBe("pass");
    expect(assertHealth(res(200, bad)).status).toBe("fail");
  });
});

describe("assertCategoryRedirect", () => {
  it("passes on 307 to the catalog facet", () => {
    const r = res(307, "", { location: "/products?category=hudi" });
    expect(assertCategoryRedirect(r).status).toBe("pass");
  });

  // A page-level redirect() is emitted as <meta http-equiv="refresh"> on a 200,
  // not a 3xx — the exact regression the G12 routing-layer redirect exists to
  // prevent. A 200 here must fail.
  it("fails on a 200 even when the body looks like a redirect", () => {
    expect(assertCategoryRedirect(res(200, `<meta http-equiv="refresh"`)).status).toBe("fail");
  });

  it("fails on a 307 pointing somewhere else", () => {
    expect(assertCategoryRedirect(res(307, "", { location: "/" })).status).toBe("fail");
  });
});

describe("countFeedItems / assertFeed", () => {
  it("counts item elements", () => {
    expect(countFeedItems("<rss><item>a</item><item>b</item></rss>")).toBe(2);
  });

  it("fails a well-formed but empty feed", () => {
    const result = assertFeed(res(200, "<rss><channel></channel></rss>"));
    expect(result.status).toBe("fail");
    expect(result.detail).toContain("0 <item>");
  });
});

describe("buildLookalikeUrl", () => {
  it("prefixes the real CDN host so a naive endsWith allow-list would serve it", () => {
    expect(buildLookalikeUrl("https://pub-abc.r2.dev/products/a.jpg")).toBe(
      "https://pub-abc.r2.dev.evil.example/x.png"
    );
  });

  it("falls back to a literal host when nothing was discovered", () => {
    expect(buildLookalikeUrl(null)).toBe("https://cdn.example.com.evil.example/x.png");
  });
});

describe("exitCodeFor", () => {
  // Nothing verified must never read as success.
  it("fails closed on an empty result set", () => {
    expect(exitCodeFor([])).toBe(1);
  });

  it("is 0 only when every row passed", () => {
    expect(exitCodeFor([{ status: "pass", detail: "" }])).toBe(0);
    expect(
      exitCodeFor([
        { status: "pass", detail: "" },
        { status: "fail", detail: "" },
      ])
    ).toBe(1);
  });
});

describe("assertNpCities", () => {
  const kyiv = { ref: NP_KYIV_CITY_REF, name: "Київ", area: "Київська" };

  it("passes when Київ comes back with its known ref", () => {
    expect(assertNpCities(res(200, JSON.stringify({ items: [kyiv] }))).status).toBe("pass");
  });

  it("fails on a 502 and names the key as a suspect", () => {
    const result = assertNpCities(res(502, "{}"));
    expect(result.status).toBe("fail");
    expect(result.detail).toContain("NOVAPOSHTA_API_KEY");
  });

  it("fails on a 503 NP_BUSY, calling it transient (re-run) and not a pass", () => {
    const result = assertNpCities(res(503, JSON.stringify({ code: "NP_BUSY", retryAfterMs: 600 })));
    expect(result.status).toBe("fail");
    expect(result.detail).toContain("NP_BUSY");
    expect(result.detail).toMatch(/throttled/i);
    expect(result.detail).toMatch(/transient/i);
    expect(result.detail).toMatch(/re-?run/i);
    expect(result.detail).not.toContain("expected 200, got 503");
  });

  it("fails when Київ is missing — some result is not enough", () => {
    const kyivets = {
      ref: "6dbe5985-96d1-11ea-a970-b8830365ade4",
      name: "Київець",
      area: "Львівська",
    };
    expect(assertNpCities(res(200, JSON.stringify({ items: [kyivets] }))).status).toBe("fail");
  });

  it("fails when the ref matches but the name does not", () => {
    const wrong = { ...kyiv, name: "Kyiv" };
    expect(assertNpCities(res(200, JSON.stringify({ items: [wrong] }))).status).toBe("fail");
  });

  it("fails when the body is not JSON", () => {
    expect(assertNpCities(res(200, "<html>")).detail).toContain("not JSON");
  });

  it("fails closed on a null or non-object body instead of throwing", () => {
    for (const body of ["null", "42", '"x"']) {
      const result = assertNpCities(res(200, body));
      expect(result.status).toBe("fail");
      expect(result.detail).toContain("not an object");
    }
  });

  it("fails with a clear message when items is missing or not an array", () => {
    for (const body of [{}, { items: "x" }, { items: null }]) {
      const result = assertNpCities(res(200, JSON.stringify(body)));
      expect(result.status).toBe("fail");
      expect(result.detail).toContain("items is not an array");
    }
  });
});

describe("assertNpCitiesFresh (I3)", () => {
  it("passes on a 200 with an empty list — what NP answers a digits-only query when the key is valid", () => {
    expect(assertNpCitiesFresh(res(200, JSON.stringify({ items: [] }))).status).toBe("pass");
  });

  it("passes on a 200 with items too — only the array shape is asserted", () => {
    const item = { ref: NP_KYIV_CITY_REF, name: "Київ", area: "Київська" };
    expect(assertNpCitiesFresh(res(200, JSON.stringify({ items: [item] }))).status).toBe("pass");
  });

  it("fails when items is not an array", () => {
    expect(assertNpCitiesFresh(res(200, JSON.stringify({ items: "x" }))).status).toBe("fail");
    expect(assertNpCitiesFresh(res(200, JSON.stringify({}))).status).toBe("fail");
  });

  it("fails on a 502 and says cached entries mask a dead key, naming NOVAPOSHTA_API_KEY", () => {
    const result = assertNpCitiesFresh(res(502, "{}"));
    expect(result.status).toBe("fail");
    expect(result.detail).toContain("NOVAPOSHTA_API_KEY");
    expect(result.detail).toMatch(/cache/i);
  });

  it("fails on a 503 NP_BUSY, calling it transient (re-run) — and the 502 message stays for a 502", () => {
    const busy = assertNpCitiesFresh(res(503, JSON.stringify({ code: "NP_BUSY" })));
    expect(busy.status).toBe("fail");
    expect(busy.detail).toContain("NP_BUSY");
    expect(busy.detail).toMatch(/throttled/i);
    expect(busy.detail).toMatch(/transient/i);
    expect(busy.detail).toMatch(/re-?run/i);
    expect(busy.detail).not.toContain("expected 200, got 503");
    expect(assertNpCitiesFresh(res(502, "{}")).detail).toContain("NOVAPOSHTA_API_KEY");
  });

  it("fails on any other status", () => {
    expect(assertNpCitiesFresh(res(500)).status).toBe("fail");
    expect(assertNpCitiesFresh(res(400)).status).toBe("fail");
  });

  it("fails when the body is not JSON", () => {
    expect(assertNpCitiesFresh(res(200, "<html>")).detail).toContain("not JSON");
  });

  it("fails closed on a null body instead of throwing", () => {
    const result = assertNpCitiesFresh(res(200, "null"));
    expect(result.status).toBe("fail");
    expect(result.detail).toContain("not an object");
  });
});
