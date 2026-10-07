/**
 * Nova Poshta directory client (G25 / TASK-049). Server code only: the key is
 * read from NOVAPOSHTA_API_KEY, which is never NEXT_PUBLIC_, so Next never
 * inlines it into a client bundle. Directory methods also answer keyless; an
 * INVALID or EXPIRED key fails every call (spec §3 findings 1–2). NP also throttles
 * keyed calls now and then; npRequest retries those and logs every failure it throws.
 * When the retries run out it throws NovaPoshtaRateLimitError carrying NP's own
 * retry hint (retryAfterMs), which the routes pass on as a 503 so the browser can
 * pause rather than give up. Every NP HTTP attempt also goes through a slot gate
 * that staggers request STARTS at least NP_MIN_SPACING_MS apart. That gate is
 * per server instance only: serverless instances do not share it, so it softens
 * a burst from one instance and is no global rate limiter.
 */
import { unstable_cache } from "next/cache";
import type { NpCity, NpWarehouseResult, WarehouseKind } from "@/lib/nova-poshta-shared";

export const NP_API_URL = "https://api.novaposhta.ua/v2.0/json/";

/**
 * «Поштомат». Decision doc §6.3: the original research named 9a68df70-… here,
 * which is «Вантажне(ий)» — a cargo BRANCH; filtering by it would have sent
 * every locker order to a branch. Re-verified live 2026-10-04.
 */
export const NP_POSTOMAT_TYPE_REF = "f9316480-5f2d-425d-bc2c-ac7cd29decf0";

/**
 * Pickup points that hand out parcels and are not postomats (spec §3, findings
 * 5–7). Filtered by CategoryOfWarehouse because no TypeOfWarehouseRef isolates
 * them: «Поштове» 841339c7-… mixes Branch + DropOff, and «Вантажне» 9a68df70-…
 * mixes Branch + Fulfillment (warehouses customers cannot use). `Store` is the
 * «Пункт приймання-видачі» that is the ONLY point in many villages (Кибляри).
 * An allowlist on purpose: an unknown future category stays out.
 */
export const BRANCH_CATEGORIES: ReadonlySet<string> = new Set(["Branch", "DropOff", "Store"]);

export const MAX_RESULTS = 50;
const CITY_LIMIT = 20;
const BRANCH_FETCH_LIMIT = 500;
const TIMEOUT_MS = 8000;
const ONE_DAY_SECONDS = 86_400;

export class NovaPoshtaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NovaPoshtaError";
  }
}

/** NP throttled the call and every retry. Still a NovaPoshtaError, so existing handling holds. */
export class NovaPoshtaRateLimitError extends NovaPoshtaError {
  /** The clamped retry hint (300–1500 ms) of the LAST throttled answer. */
  readonly retryAfterMs: number;

  constructor(message: string, retryAfterMs: number = DEFAULT_RETRY_DELAY_MS) {
    super(message);
    this.name = "NovaPoshtaRateLimitError";
    this.retryAfterMs = retryAfterMs;
  }
}

// NP sporadically throttles keyed calls with success:false — «To many requests» (NP's
// own typo) or «Try again after 0.5 seconds» (measured live 2026-10-05: back-to-back
// keyed getWarehouses bursts failed ~3 of 5). A throttled call is retried; nothing else is.
const RATE_LIMIT_PATTERN = /many requests|try again after/i;
const RETRY_HINT_PATTERN = /after\s+([0-9.]+)\s*seconds/i;
const MAX_RETRIES = 2;
const DEFAULT_RETRY_DELAY_MS = 600;
const MIN_RETRY_DELAY_MS = 300;
const MAX_RETRY_DELAY_MS = 1500;
const RETRY_BUDGET_MS = 5000;

function retryDelayMs(errors: string[]): number {
  for (const text of errors) {
    const hint = RETRY_HINT_PATTERN.exec(text);
    const seconds = hint ? Number(hint[1]) : NaN;
    if (Number.isFinite(seconds)) {
      return Math.min(MAX_RETRY_DELAY_MS, Math.max(MIN_RETRY_DELAY_MS, seconds * 1000));
    }
  }
  return DEFAULT_RETRY_DELAY_MS;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Minimum gap between the STARTS of two NP requests from one server instance. */
export const NP_MIN_SPACING_MS = 150;
let minSpacingMs = NP_MIN_SPACING_MS;
let nextSlot = 0;

/**
 * Test-only: overrides the spacing (0 disables the stagger) and resets the slot
 * clock. Production code never calls it.
 */
export function setNpMinSpacingMs(ms: number): void {
  minSpacingMs = ms;
  nextSlot = 0;
}

/**
 * Reserves the next start slot and sleeps until it. Only the reservation is
 * synchronous: no lock is held across the fetch, so responses are never serialised.
 */
async function waitForSlot(): Promise<void> {
  if (minSpacingMs <= 0) return;
  const now = Date.now();
  const slot = Math.max(now, nextSlot);
  nextSlot = slot + minSpacingMs;
  if (slot > now) await sleep(slot - now);
}

interface RawCity {
  Ref: string;
  Description: string;
  AreaDescription: string;
}

interface RawWarehouse {
  Ref: string;
  Number: string;
  Description: string;
  CategoryOfWarehouse: string;
  WarehouseStatus: string;
  DenyToSelect: string;
}

interface NpEnvelope<T> {
  success?: boolean;
  data?: T[] | null;
  errors?: string[];
  info?: { totalCount?: number } | unknown[];
}

/**
 * Every apostrophe form keyboards and autocorrect produce, except U+0027 itself —
 * the same set src/lib/slug.ts keeps: U+2019, U+2018, U+02BC (the one Ukrainian
 * orthography prescribes), U+02BB, U+0060 and U+00B4. NP spells names with the
 * ASCII apostrophe only; live, keyless 2026-10-05, «кам'янське» answers 5 cities
 * while the U+2019 and U+02BC spellings answer success:true with an empty list —
 * the picker would say «Нічого не знайдено» and never fall back.
 */
const NON_ASCII_APOSTROPHES = /[\u2019\u2018\u02BC\u02BB\u0060\u00B4]/g;

/**
 * Case and whitespace: NP's search is case-insensitive (verified live), so those only
 * make cache keys converge. Apostrophes: NP matches only the ASCII one, so this is
 * also the text actually sent as FindByString.
 */
export function normalizeQuery(q: string): string {
  return q.trim().replace(/\s+/g, " ").toLowerCase().replace(NON_ASCII_APOSTROPHES, "'");
}

export async function npRequest<T>(
  modelName: string,
  calledMethod: string,
  methodProperties: Record<string, string>
): Promise<{ data: T[]; totalCount: number }> {
  try {
    return await attemptNpRequest<T>(modelName, calledMethod, methodProperties);
  } catch (error) {
    // Logged here, in the lib: the API routes deliberately swallow the reason (no
    // console.error in routes), and production 502s were undiagnosable without it.
    // The reason carries NP's error text and never the API key (it is only ever in
    // the request body).
    const reason = error instanceof Error ? error.message : String(error);
    console.warn("[np] request failed", { method: calledMethod, reason });
    throw error;
  }
}

async function attemptNpRequest<T>(
  modelName: string,
  calledMethod: string,
  methodProperties: Record<string, string>
): Promise<{ data: T[]; totalCount: number }> {
  const startedAt = Date.now();
  for (let attempt = 0; ; attempt++) {
    const outcome = await requestOnce<T>(modelName, calledMethod, methodProperties);
    if (!("rateLimitErrors" in outcome)) return outcome;

    const { rateLimitErrors } = outcome;
    const delay = retryDelayMs(rateLimitErrors);
    if (attempt >= MAX_RETRIES || Date.now() - startedAt >= RETRY_BUDGET_MS) {
      throw new NovaPoshtaRateLimitError(`NP rate limit: ${rateLimitErrors.join("; ")}`, delay);
    }
    await sleep(delay);
  }
}

/** One attempt: the parsed result, or `{ rateLimitErrors }` when NP throttled it. Any other failure throws. */
async function requestOnce<T>(
  modelName: string,
  calledMethod: string,
  methodProperties: Record<string, string>
): Promise<{ data: T[]; totalCount: number } | { rateLimitErrors: string[] }> {
  await waitForSlot();
  let response: Awaited<ReturnType<typeof fetch>>;
  try {
    response = await fetch(NP_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apiKey: process.env.NOVAPOSHTA_API_KEY ?? "",
        modelName,
        calledMethod,
        methodProperties,
      }),
      // Caching happens one layer up, in unstable_cache — which also forces
      // nested fetches to no-store (spec §5.3). Stated here for intent.
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new NovaPoshtaError(`request failed: ${reason}`);
  }
  if (!response.ok) throw new NovaPoshtaError(`HTTP ${response.status}`);

  let body: NpEnvelope<T>;
  try {
    body = await response.json();
  } catch {
    throw new NovaPoshtaError("unparseable response body");
  }
  if (body?.success !== true || !Array.isArray(body.data)) {
    const errors = Array.isArray(body?.errors)
      ? body.errors.filter((e) => typeof e === "string")
      : [];
    if (body?.success === false && errors.some((text) => RATE_LIMIT_PATTERN.test(text))) {
      return { rateLimitErrors: errors };
    }
    throw new NovaPoshtaError(`NP error: ${errors.length ? errors.join("; ") : "success: false"}`);
  }

  const info = body.info;
  const totalCount =
    info && !Array.isArray(info) && typeof info.totalCount === "number"
      ? info.totalCount
      : body.data.length;
  return { data: body.data, totalCount };
}

/**
 * A city name NP can match has a Cyrillic letter (or a digit — «12» is a valid empty
 * search). Live, keyless 2026-10-04: "Kyiv", "ky", "rb]d" (Київ typed on an EN layout)
 * and "--" answer success:false / "FindByString is not specified", which would read as
 * an outage and drop the checkout to manual entry; "12" and "кb" answer success:true
 * with an empty list. So the former never reach NP.
 */
const SEARCHABLE_CITY_QUERY = /[\u0400-\u04FF0-9]/;

export async function searchCities(q: string): Promise<NpCity[]> {
  const query = normalizeQuery(q);
  if (!SEARCHABLE_CITY_QUERY.test(query)) return [];
  const { data } = await npRequest<RawCity>("Address", "getCities", {
    FindByString: query,
    Limit: String(CITY_LIMIT),
  });
  return data.map((city) => ({
    ref: city.Ref,
    name: city.Description,
    area: city.AreaDescription,
  }));
}

function isSelectable(point: RawWarehouse): boolean {
  return point.WarehouseStatus === "Working" && point.DenyToSelect !== "1";
}

export async function searchWarehouses(
  cityRef: string,
  kind: WarehouseKind,
  q: string
): Promise<NpWarehouseResult> {
  const query = normalizeQuery(q);
  const properties: Record<string, string> =
    kind === "postomat"
      ? { CityRef: cityRef, TypeOfWarehouseRef: NP_POSTOMAT_TYPE_REF, Limit: String(MAX_RESULTS) }
      : { CityRef: cityRef, Limit: String(BRANCH_FETCH_LIMIT) };
  if (query) properties.FindByString = query;

  const { data, totalCount } = await npRequest<RawWarehouse>(
    "Address",
    "getWarehouses",
    properties
  );
  const matching = data.filter(
    (point) =>
      isSelectable(point) &&
      (kind === "postomat"
        ? point.CategoryOfWarehouse === "Postomat"
        : BRANCH_CATEGORIES.has(point.CategoryOfWarehouse))
  );

  return {
    items: matching.slice(0, MAX_RESULTS).map((point) => ({
      ref: point.Ref,
      number: point.Number,
      name: point.Description,
    })),
    truncated: matching.length > MAX_RESULTS || totalCount > data.length,
  };
}

// A thrown error is never cached — an NP outage retries on the next request. But
// unstable_cache (Next 14.2.35) is stale-while-revalidate: once an entry exists, a
// dead key keeps being answered from it (the failed revalidation is only logged),
// so only NEW queries surface a 502. The smoke row that detects a dead key is the
// uncached one (scripts/smoke-lib.ts assertNpCitiesFresh), not the Київ row.
const citiesCache = unstable_cache(searchCities, ["np-cities-v1"], {
  revalidate: ONE_DAY_SECONDS,
});
const warehousesCache = unstable_cache(searchWarehouses, ["np-warehouses-v1"], {
  revalidate: ONE_DAY_SECONDS,
});

/** Daily-cached city search; the query is normalised first so equivalent queries share one entry. */
export function cachedSearchCities(q: string): Promise<NpCity[]> {
  return citiesCache(normalizeQuery(q));
}

/** Daily-cached pickup-point search, normalised the same way. */
export function cachedSearchWarehouses(
  cityRef: string,
  kind: WarehouseKind,
  q: string
): Promise<NpWarehouseResult> {
  // NP_REF_PATTERN is case-insensitive: one city must map to one cache entry.
  return warehousesCache(cityRef.toLowerCase(), kind, normalizeQuery(q));
}
