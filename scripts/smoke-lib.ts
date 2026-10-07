/**
 * Pure helpers for the post-deploy smoke script (scripts/smoke.ts).
 *
 * Everything here is a pure function over strings and plain objects: no fetch,
 * no filesystem, no module-scope side effects. tests/unit/smoke.test.ts imports
 * this file directly, so anything that ran at import time would run during the
 * unit suite.
 */

const CSS_CHUNK_RE = /\/_next\/static\/css\/([a-z0-9]+)\.css/g;
const NEXT_ASSET_RE = /\/_next\/[^\s"'\\]*/g;
const PRODUCT_SLUG_RE = /\/products\/([a-z0-9][a-z0-9-]{2,})(?=["'?#\\/]|$)/g;
const IMAGE_PARAM_RE = /\/_next\/image\?url=([^"'&\s\\]+)/g;

/** Every distinct `/_next/static/css/<hash>.css` chunk hash, sorted. */
export function extractCssHashes(html: string): string[] {
  const found = new Set<string>();
  for (const match of html.matchAll(CSS_CHUNK_RE)) found.add(match[1]);
  return [...found].sort();
}

/**
 * Product slugs linked from server-rendered HTML.
 *
 * The danger being defended against: a `/_next/**` asset path that contains a
 * literal `/products/` segment would be reported as a product, turning the
 * homepage's DB-backed assertion into one that passes on an empty catalog.
 *
 * Two mechanisms do that work, and they cover different shapes. PRODUCT_SLUG_RE's
 * lookahead rejects anything followed by a file extension, which is what rules out
 * the catalog page's real chunk, `…/products/page-<hash>.js` (the `.` is not in the
 * lookahead set). Stripping `/_next/**` first covers the shapes the lookahead does
 * NOT catch — a `/products/<segment>` followed by `/`, `?`, `#` or a quote, as in
 * `/_next/static/media/products/hero-banner/1x.avif`. Both cases are tested; the
 * second one fails if the strip is removed, the first does not.
 */
export function extractProductSlugs(html: string): string[] {
  const withoutAssets = html.replace(NEXT_ASSET_RE, " ");
  const found = new Set<string>();
  for (const match of withoutAssets.matchAll(PRODUCT_SLUG_RE)) found.add(match[1]);
  return [...found].sort();
}

/**
 * The first absolute, off-origin image URL the page hands to /_next/image.
 *
 * Returns null when the page only optimises root-relative assets (the seeded
 * placeholder catalog) — the caller then skips the accept probe and says so,
 * rather than inventing a URL.
 */
export function findRemoteImageUrl(html: string, targetOrigin: string): string | null {
  let targetHost: string;
  try {
    targetHost = new URL(targetOrigin).host;
  } catch {
    return null;
  }

  for (const match of html.matchAll(IMAGE_PARAM_RE)) {
    let decoded: string;
    try {
      decoded = decodeURIComponent(match[1]);
    } catch {
      continue;
    }
    if (!/^https?:\/\//i.test(decoded)) continue;
    try {
      if (new URL(decoded).host !== targetHost) return decoded;
    } catch {
      continue;
    }
  }
  return null;
}

export type StalenessOutcome = "CHANGED" | "UNCHANGED" | "NO-BASELINE" | "NO-CSS";

export interface SmokeStateEntry {
  cssHashes: string[];
  observedAt: string;
}

export interface SmokeState {
  [origin: string]: SmokeStateEntry;
}

/**
 * Four outcomes, and only CHANGED passes. Neither an absent baseline nor an
 * absent stylesheet is a pass: a check that cannot fail looks exactly like one
 * that passes, and this one guards a real incident (Vercel served
 * byte-identical stale CSS across two deploys).
 */
export function compareBaseline(observed: string[], stored: string[] | null): StalenessOutcome {
  // Checked FIRST. A page that served no stylesheet at all cannot be compared,
  // and calling that "CHANGED" would pass a deploy whose CSS vanished entirely —
  // the same "a check that cannot fail" trap NO-BASELINE guards, entered from
  // the observed side instead of the stored side.
  if (observed.length === 0) return "NO-CSS";
  if (stored === null || stored.length === 0) return "NO-BASELINE";
  const a = [...observed].sort().join(",");
  const b = [...stored].sort().join(",");
  return a === b ? "UNCHANGED" : "CHANGED";
}

export function stalenessPasses(outcome: StalenessOutcome, allowMissing: boolean): boolean {
  if (outcome === "CHANGED") return true;
  // NO-CSS is deliberately NOT waivable: --allow-missing-baseline excuses a
  // missing BASELINE, never a page that served no stylesheet.
  if (outcome === "NO-BASELINE") return allowMissing;
  return false;
}

export function readBaselineFor(state: SmokeState, origin: string): string[] | null {
  const entry = state[origin];
  return entry && Array.isArray(entry.cssHashes) ? entry.cssHashes : null;
}

export function mergeState(
  state: SmokeState,
  origin: string,
  cssHashes: string[],
  observedAt: string
): SmokeState {
  return { ...state, [origin]: { cssHashes: [...cssHashes].sort(), observedAt } };
}

export interface HttpResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
}

export interface ProbeResult {
  status: "pass" | "fail";
  detail: string;
}

const pass = (detail: string): ProbeResult => ({ status: "pass", detail });
const fail = (detail: string): ProbeResult => ({ status: "fail", detail });
const wrongStatus = (expected: number, got: number) => fail(`expected ${expected}, got ${got}`);

/**
 * 503 NP_BUSY: Nova Poshta throttled the request and the route's own retries ran out.
 * Still a FAIL (a 503 is not a pass), but the message says it is usually transient.
 */
const npBusy = () =>
  fail(
    "503 NP_BUSY — Nova Poshta throttled the request; this is usually transient, so re-run the row " +
      "(a key problem answers 502, not 503)"
  );

export function assertStatus(expected: number) {
  return (res: HttpResponse): ProbeResult =>
    res.status === expected ? pass(String(res.status)) : wrongStatus(expected, res.status);
}

/** The DB-backed string assertion. See spec §2.1: it lives on `/`, not `/products`. */
export function assertHomepage(res: HttpResponse): ProbeResult {
  if (res.status !== 200) return wrongStatus(200, res.status);
  const slugs = extractProductSlugs(res.body);
  return slugs.length > 0
    ? pass(`200, ${slugs.length} product link(s)`)
    : fail("200 but no /products/<slug> link in server HTML — DB-backed render missing");
}

export function assertProductsApi(res: HttpResponse): ProbeResult {
  if (res.status !== 200) return wrongStatus(200, res.status);
  let parsed: { data?: Array<{ slug?: unknown }> };
  try {
    parsed = JSON.parse(res.body);
  } catch {
    return fail("200 but the body is not JSON");
  }
  const slug = parsed.data?.[0]?.slug;
  return typeof slug === "string" && slug.length > 0
    ? pass(`200, first slug "${slug}"`)
    : fail("200 but data[0].slug is missing — the catalog query returned nothing");
}

export function assertHealth(res: HttpResponse): ProbeResult {
  if (res.status !== 200) return wrongStatus(200, res.status);
  let parsed: { checks?: { database?: { status?: unknown } } };
  try {
    parsed = JSON.parse(res.body);
  } catch {
    return fail("200 but the body is not JSON");
  }
  const db = parsed.checks?.database?.status;
  return db === "ok"
    ? pass("200, database ok")
    : fail(`200 but checks.database.status is ${JSON.stringify(db)}`);
}

/** Київ's CityRef in the NP directory — a stable id (verified live 2026-10-04). */
export const NP_KYIV_CITY_REF = "8d5a980d-391c-11dd-90d9-001a92567626";

/**
 * G25: the cached proxy maps «київ» to the fixed ref and name of Київ — compared
 * against both, not "some result", so a wrong mapping fails too. It checks the MAPPING
 * only: the key/outage detector is the fresh-query row (assertNpCitiesFresh).
 */
export function assertNpCities(res: HttpResponse): ProbeResult {
  if (res.status === 503) return npBusy();
  if (res.status === 502) {
    return fail(
      "502 NP_UNAVAILABLE — Nova Poshta unreachable, or NOVAPOSHTA_API_KEY invalid/expired"
    );
  }
  if (res.status !== 200) return wrongStatus(200, res.status);
  let parsed: unknown;
  try {
    parsed = JSON.parse(res.body);
  } catch {
    return fail("200 but the body is not JSON");
  }
  if (!parsed || typeof parsed !== "object") return fail("200 but the body is not an object");
  const items = (parsed as { items?: unknown }).items;
  if (!Array.isArray(items)) return fail("200 but items is not an array");
  const kyiv = (items as Array<{ ref?: unknown; name?: unknown } | null>).find(
    (item) => item?.ref === NP_KYIV_CITY_REF
  );
  return kyiv?.name === "Київ"
    ? pass(`200, Київ → ${NP_KYIV_CITY_REF}`)
    : fail(`200 but no item { ref: ${NP_KYIV_CITY_REF}, name: "Київ" }`);
}

/**
 * G25 final review I3: the real dead-key detector. The Київ row above is served
 * from `unstable_cache`, which (Next 14.2.35) answers a STALE entry and revalidates
 * in the background — a revalidation that throws is only logged, so that row stays
 * PASS indefinitely after the key dies. This row asks a query no cache has ever
 * seen (smoke.ts sends fresh digits per run): NP answers success:true with an empty
 * list for a digits-only query when the key is valid or absent, and success:false
 * otherwise, so only a live NP call can pass it.
 */
export function assertNpCitiesFresh(res: HttpResponse): ProbeResult {
  if (res.status === 503) return npBusy();
  if (res.status === 502) {
    return fail(
      "502 NP_UNAVAILABLE on a never-cached query — NOVAPOSHTA_API_KEY invalid/expired, or NP unreachable. " +
        "Cached entries keep answering a dead key (stale-while-revalidate), so this row, not the Київ one, is the detector"
    );
  }
  if (res.status !== 200) return wrongStatus(200, res.status);
  let parsed: unknown;
  try {
    parsed = JSON.parse(res.body);
  } catch {
    return fail("200 but the body is not JSON");
  }
  if (!parsed || typeof parsed !== "object") return fail("200 but the body is not an object");
  return Array.isArray((parsed as { items?: unknown }).items)
    ? pass("200, uncached query answered through NP")
    : fail("200 but items is not an array");
}

/**
 * 307 specifically, and to the catalog facet specifically. A redirect() thrown
 * inside a Server Component is captured by Next's RedirectBoundary and emitted
 * as <meta http-equiv="refresh"> on a 200 — which is why this asserts the
 * status code and not the rendered body (G12).
 */
export function assertCategoryRedirect(res: HttpResponse): ProbeResult {
  if (res.status !== 307) return wrongStatus(307, res.status);
  const location = res.headers["location"];
  return location === "/products?category=hudi"
    ? pass("307 → /products?category=hudi")
    : fail(`307 but location is ${JSON.stringify(location)}`);
}

export function countFeedItems(xml: string): number {
  return (xml.match(/<item>/g) || []).length;
}

/**
 * The feed route filters with validateFeedItemSafe, which drops an invalid item
 * SILENTLY — production served a well-formed, empty, HTTP-200 feed for roughly
 * two months before G16 noticed. A status check alone would not have caught it.
 */
export function assertFeed(res: HttpResponse): ProbeResult {
  if (res.status !== 200) return wrongStatus(200, res.status);
  const count = countFeedItems(res.body);
  return count > 0
    ? pass(`200, ${count} item(s)`)
    : fail("200 but 0 <item> entries — every product was dropped from the feed");
}

const FALLBACK_CDN_HOST = "cdn.example.com";

/**
 * The lookalike host an `endsWith`-style allow-list would wrongly serve:
 * the REAL CDN host with an attacker suffix. Built from the discovered host so
 * the probe stays meaningful after the domain swap.
 */
export function buildLookalikeUrl(remoteImageUrl: string | null): string {
  let host = FALLBACK_CDN_HOST;
  if (remoteImageUrl) {
    try {
      host = new URL(remoteImageUrl).host;
    } catch {
      host = FALLBACK_CDN_HOST;
    }
  }
  return `https://${host}.evil.example/x.png`;
}

/**
 * Fails CLOSED on an empty array. Zero collected results means nothing was
 * verified, and "nothing was verified" must never read as success — the same
 * trap compareBaseline's empty-observed guard closes, one level up at the
 * aggregate gate.
 */
export function exitCodeFor(results: ProbeResult[]): number {
  return results.length > 0 && results.every((result) => result.status === "pass") ? 0 : 1;
}
