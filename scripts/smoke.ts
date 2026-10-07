/**
 * Post-deploy smoke check.
 *
 *   npm run smoke -- --url https://your-deployment.example.com
 *
 * Every production deploy in this project's history was confirmed by a person
 * opening the site. GitHub Actions runs CI only (its old "Deploy to Vercel" job
 * never deployed and was retired in G28), so a green badge proves nothing. This
 * turns that ritual into a command that exits non-zero.
 *
 * Flags:
 *   --url <target>              required; origin to probe
 *   --baseline <file>           read/write the CSS-hash baseline at this file (read at the start,
 *                               overwritten with the observed hashes at the end of the run)
 *   --save-baseline <file>      write the observed baseline here and exit 0
 *   --allow-missing-baseline    NO-BASELINE stops being a failure
 *   --json                      emit results as JSON (exit contract unchanged)
 *
 * Route paths are literals here — they are the probe definitions. What is
 * discovered from the target's own homepage at run time is the DATA: the CSS
 * chunk hashes, the product slugs, and the remote image URL the rejection
 * probes are built from. Nothing pins a product name or a CDN hostname, so the
 * script survives catalog edits and the real-domain cutover without an edit.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import {
  assertCategoryRedirect,
  assertFeed,
  assertHealth,
  assertNpCities,
  assertNpCitiesFresh,
  assertHomepage,
  assertProductsApi,
  assertStatus,
  buildLookalikeUrl,
  compareBaseline,
  exitCodeFor,
  extractCssHashes,
  findRemoteImageUrl,
  mergeState,
  readBaselineFor,
  stalenessPasses,
  type HttpResponse,
  type ProbeResult,
  type SmokeState,
  type StalenessOutcome,
} from "./smoke-lib";

const DEFAULT_STATE_FILE = ".smoke-state.json";
const TIMEOUT_MS = 20_000;

// One message per outcome, read by BOTH branches, so the row can never print a
// detail that disagrees with its own status.
//
// A full Record over the union — deliberately NOT Record<Exclude<…, "CHANGED">>.
// stalenessPasses() returns an opaque boolean, so a ternary cannot narrow
// `outcome` away from "CHANGED" in the fail branch; the three-key version needs
// an `as Exclude<…>` cast to compile, and that cast asserts a guarantee living
// in ANOTHER module. Change the pass rule in smoke-lib.ts and the cast silently
// indexes a missing key, printing `FAIL  CSS chunk hashes  undefined`. One
// unused entry is the cheaper trade, and the compiler still demands a message
// for every outcome added later.
const STALENESS_DETAIL: Record<StalenessOutcome, string> = {
  CHANGED: "CHANGED — the served CSS differs from the previous run",
  UNCHANGED: "UNCHANGED — the build cache may have served stale CSS; redeploy with the cache off",
  "NO-BASELINE":
    "NO-BASELINE — no stored hashes for this origin; re-run, or pass --allow-missing-baseline",
  "NO-CSS": "NO-CSS — the page served no stylesheet at all; the deploy is very likely broken",
};

interface Options {
  url: string;
  baselineFile: string;
  saveBaselineOnly: boolean;
  allowMissingBaseline: boolean;
  json: boolean;
}

function parseArgs(argv: string[]): Options {
  const flag = (name: string): string | undefined => {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const has = (name: string) => argv.includes(`--${name}`);

  const url = flag("url");
  if (!url) {
    throw new Error("--url is required, e.g. npm run smoke -- --url https://example.com");
  }
  const saveTo = flag("save-baseline");
  return {
    url: new URL(url).origin,
    baselineFile: saveTo || flag("baseline") || DEFAULT_STATE_FILE,
    saveBaselineOnly: Boolean(saveTo),
    allowMissingBaseline: has("allow-missing-baseline"),
    json: has("json"),
  };
}

async function get(url: string): Promise<HttpResponse> {
  const response = await fetch(url, {
    redirect: "manual",
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { "user-agent": "mirox-smoke/1.0", "cache-control": "no-cache" },
  });
  const headers: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value;
  });
  return { status: response.status, headers, body: await response.text() };
}

function loadState(file: string): SmokeState {
  if (!existsSync(file)) return {};
  try {
    return JSON.parse(readFileSync(file, "utf8")) as SmokeState;
  } catch {
    return {};
  }
}

function imageProbeUrl(origin: string, target: string): string {
  return `${origin}/_next/image?url=${encodeURIComponent(target)}&w=640&q=75`;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const origin = options.url;

  // One fetch builds the context every other row depends on.
  const homepage = await get(`${origin}/`);
  const cssHashes = extractCssHashes(homepage.body);
  const remoteImage = findRemoteImageUrl(homepage.body, origin);

  if (options.saveBaselineOnly) {
    const state = mergeState(
      loadState(options.baselineFile),
      origin,
      cssHashes,
      new Date().toISOString()
    );
    writeFileSync(options.baselineFile, `${JSON.stringify(state, null, 2)}\n`);
    console.log(`baseline saved to ${options.baselineFile}: ${cssHashes.join(", ") || "(none)"}`);
    console.log("no probes were run — this exit 0 reflects the baseline save only, not a pass");
    return;
  }

  const rows: Array<{ label: string; result: ProbeResult }> = [];
  const probe = async (label: string, url: string, assert: (r: HttpResponse) => ProbeResult) => {
    try {
      rows.push({ label, result: assert(await get(url)) });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      rows.push({ label, result: { status: "fail", detail: `request failed: ${reason}` } });
    }
  };

  rows.push({ label: "GET /", result: assertHomepage(homepage) });
  await probe("GET /products", `${origin}/products`, assertStatus(200));
  await probe("GET /api/products", `${origin}/api/products?limit=1`, assertProductsApi);
  await probe("GET /api/health", `${origin}/api/health`, assertHealth);
  await probe(
    "GET /api/shipping/np/cities",
    `${origin}/api/shipping/np/cities?q=${encodeURIComponent("київ")}`,
    assertNpCities
  );
  // A query NP's cache has never held (digits are valid and match nothing), so
  // unstable_cache cannot answer it: see assertNpCitiesFresh.
  await probe(
    "GET /api/shipping/np/cities (uncached)",
    `${origin}/api/shipping/np/cities?q=${String(Date.now()).slice(-8)}`,
    assertNpCitiesFresh
  );
  await probe("GET /categories/hudi", `${origin}/categories/hudi`, assertCategoryRedirect);

  // Staleness: CHANGED passes, UNCHANGED fails, NO-BASELINE also fails.
  const state = loadState(options.baselineFile);
  const outcome = compareBaseline(cssHashes, readBaselineFor(state, origin));
  rows.push({
    label: "CSS chunk hashes",
    result: {
      status: stalenessPasses(outcome, options.allowMissingBaseline) ? "pass" : "fail",
      detail: `${STALENESS_DETAIL[outcome]}${cssHashes.length ? ` (${cssHashes.join(", ")})` : ""}`,
    },
  });

  // The accept probe FIRST: if remotePatterns came back empty at build time,
  // every remote host 400s and the three rejection rows below would go green
  // on a broken deploy. This row is what gives them meaning.
  if (remoteImage) {
    const remoteHost = new URL(remoteImage).host;
    await probe("GET /_next/image (real CDN)", imageProbeUrl(origin, remoteImage), (res) =>
      res.status === 200
        ? { status: "pass", detail: `200 — ${remoteHost}` }
        : { status: "fail", detail: `expected 200, got ${res.status}` }
    );
  } else {
    rows.push({
      label: "GET /_next/image (real CDN)",
      result: {
        status: "fail",
        detail: "no remote image found on the homepage — the rejection probes below prove nothing",
      },
    });
  }
  await probe(
    "GET /_next/image (arbitrary)",
    imageProbeUrl(origin, "https://example.invalid/x.png"),
    assertStatus(400)
  );
  await probe(
    "GET /_next/image (metadata)",
    imageProbeUrl(origin, "http://169.254.169.254/latest/meta-data/"),
    assertStatus(400)
  );
  await probe(
    "GET /_next/image (lookalike)",
    imageProbeUrl(origin, buildLookalikeUrl(remoteImage)),
    assertStatus(400)
  );

  await probe("GET /feed/google-shopping.xml", `${origin}/feed/google-shopping.xml`, assertFeed);
  await probe("GET /track", `${origin}/track`, assertStatus(200));
  await probe("GET /sitemap.xml", `${origin}/sitemap.xml`, assertStatus(200));
  await probe("GET /robots.txt", `${origin}/robots.txt`, assertStatus(200));

  const results = rows.map((row) => row.result);

  if (options.json) {
    console.log(JSON.stringify({ origin, staleness: outcome, rows }, null, 2));
  } else {
    console.log(`\n  smoke check → ${origin}\n`);
    for (const row of rows) {
      const mark = row.result.status === "pass" ? "PASS" : "FAIL";
      console.log(`  ${mark}  ${row.label.padEnd(40)} ${row.result.detail}`);
    }
    const failed = results.filter((r) => r.status === "fail").length;
    console.log(`\n  ${results.length - failed} passed, ${failed} failed\n`);
  }

  // Record the observed hashes even on failure, so the NEXT run is meaningful.
  writeFileSync(
    options.baselineFile,
    `${JSON.stringify(mergeState(state, origin, cssHashes, new Date().toISOString()), null, 2)}\n`
  );

  process.exitCode = exitCodeFor(results);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
