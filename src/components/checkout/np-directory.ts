import { formatNpArea } from "@/lib/nova-poshta-shared";
import type { NpCity, NpWarehouse, WarehouseKind } from "@/lib/nova-poshta-shared";
import type { ComboboxPage } from "./NpCombobox";

/**
 * A 5xx, a network error or an unexpected body from our NP routes. The pickers
 * treat every such failure alike: the checkout drops to manual entry for the
 * visit (spec §5.7). A 400 is NOT one — see EMPTY_PAGE.
 */
export class NpDirectoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NpDirectoryError";
  }
}

const isString = (value: unknown): value is string => typeof value === "string";

function isCity(value: unknown): value is NpCity {
  const city = value as NpCity | null;
  return !!city && isString(city.ref) && isString(city.name) && isString(city.area);
}

function isWarehouse(value: unknown): value is NpWarehouse {
  const point = value as NpWarehouse | null;
  return !!point && isString(point.ref) && isString(point.number) && isString(point.name);
}

/**
 * Our routes answer 400 for a query they refuse (too short, too long). That says
 * nothing about Nova Poshta, so it settles as «nothing found» rather than tripping
 * the visit-long manual-entry fallback (final review I1/I2).
 */
const EMPTY_PAGE: ComboboxPage = { options: [], truncated: false };

/**
 * A transient failure (a 5xx that is not NP_BUSY, a network error) gets ONE quiet retry
 * after this delay: a lone blip must not cost the customer the picker for the visit.
 */
const RETRY_DELAY_MS = 700;

/**
 * Our routes answer 503 {code:"NP_BUSY", retryAfterMs} when Nova Poshta throttled the
 * call and the server's own retries ran out. That is NP's own «slow down» signal, so
 * the browser pauses for the hinted time and tries again rather than giving up.
 */
const BUSY_CODE = "NP_BUSY";
const BUSY_RETRIES = 2;
const DEFAULT_BUSY_MS = 800;
const MIN_BUSY_MS = 300;
const MAX_BUSY_MS = 3000;
/** BUSY retries + the one generic retry + the first try: never loop past this. */
const MAX_ATTEMPTS = 4;

/**
 * Epoch ms before which no request leaves this tab. One BUSY answer pauses every later
 * call (cities AND branches), so a burst of searches does not keep hammering NP while it
 * is asking us to slow down.
 */
let cooldownUntil = 0;

/** Test-only: forgets the shared cooldown so unit tests do not leak state into each other. */
export function __resetNpCooldown(): void {
  cooldownUntil = 0;
}

/** Resolves after `ms`; rejects with an AbortError the moment `signal` aborts. */
function waitOrAbort(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const abortError = () => new DOMException("The operation was aborted.", "AbortError");
    if (signal.aborted) return reject(abortError());
    const onAbort = () => {
      clearTimeout(timer);
      reject(abortError());
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

/** The pause a 503 asks for, or null when the answer is not NP_BUSY. */
async function busyPauseMs(response: Response): Promise<number | null> {
  if (response.status !== 503) return null;
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return null;
  }
  if (!body || typeof body !== "object" || (body as { code?: unknown }).code !== BUSY_CODE) {
    return null;
  }
  const fromBody = (body as { retryAfterMs?: unknown }).retryAfterMs;
  const fromHeader = Number(response.headers?.get("Retry-After")) * 1000;
  const hint =
    typeof fromBody === "number" && Number.isFinite(fromBody)
      ? fromBody
      : Number.isFinite(fromHeader) && fromHeader > 0
        ? fromHeader
        : DEFAULT_BUSY_MS;
  return Math.min(MAX_BUSY_MS, Math.max(MIN_BUSY_MS, hint));
}

/** An abort must surface as an abort — never as a failure that trips the manual-entry fallback. */
function rejectIfAborted(signal: AbortSignal): void {
  if (signal.aborted) throw new DOMException("The operation was aborted.", "AbortError");
}

async function getJson(url: string, signal: AbortSignal): Promise<Record<string, unknown> | null> {
  let response: Response | undefined;
  let busyRetries = 0;
  let genericRetried = false;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    // Honour a cooldown any earlier call set (abortably, capped at one maximum pause).
    const cooling = Math.min(cooldownUntil - Date.now(), MAX_BUSY_MS);
    if (cooling > 0) await waitOrAbort(cooling, signal);
    const lastAttempt = attempt === MAX_ATTEMPTS - 1;

    try {
      response = await fetch(url, { signal });
    } catch (error) {
      // An aborted fetch is the caller moving on — never retried, never a failure.
      if (signal.aborted || genericRetried || lastAttempt) throw error;
      genericRetried = true;
      await waitOrAbort(RETRY_DELAY_MS, signal);
      continue;
    }

    const pause = await busyPauseMs(response);
    rejectIfAborted(signal); // the caller may have moved on while the 503 body was read
    if (pause !== null) {
      cooldownUntil = Math.max(cooldownUntil, Date.now() + pause);
      if (busyRetries >= BUSY_RETRIES || lastAttempt) {
        throw new NpDirectoryError(`${url} stayed busy (${response.status})`);
      }
      busyRetries++;
      continue; // the next pass waits out the cooldown first
    }
    if (response.status >= 500 && !genericRetried && !lastAttempt) {
      genericRetried = true;
      await waitOrAbort(RETRY_DELAY_MS, signal);
      continue;
    }
    break;
  }
  rejectIfAborted(signal);
  if (!response) throw new NpDirectoryError(`${url}: no response`);
  if (response.status === 400) return null;
  if (!response.ok) throw new NpDirectoryError(`${url} answered ${response.status}`);
  const body: unknown = await response.json();
  if (!body || typeof body !== "object")
    throw new NpDirectoryError(`${url}: body is not an object`);
  return body as Record<string, unknown>;
}

export async function fetchNpCities(query: string, signal: AbortSignal): Promise<ComboboxPage> {
  const body = await getJson(`/api/shipping/np/cities?q=${encodeURIComponent(query)}`, signal);
  if (!body) return EMPTY_PAGE;
  const items = body.items;
  if (!Array.isArray(items) || !items.every(isCity)) {
    throw new NpDirectoryError("unexpected cities body");
  }
  return {
    options: items.map((city) => ({
      value: city.ref,
      label: city.name,
      description: formatNpArea(city.area),
    })),
    truncated: false,
  };
}

export async function fetchNpWarehouses(
  cityRef: string,
  kind: WarehouseKind,
  query: string,
  signal: AbortSignal
): Promise<ComboboxPage> {
  const params = new URLSearchParams({ city: cityRef, kind, q: query });
  const body = await getJson(`/api/shipping/np/warehouses?${params}`, signal);
  if (!body) return EMPTY_PAGE;
  const items = body.items;
  if (!Array.isArray(items) || !items.every(isWarehouse) || typeof body.truncated !== "boolean") {
    throw new NpDirectoryError("unexpected warehouses body");
  }
  return {
    options: items.map((point) => ({ value: point.ref, label: point.name })),
    truncated: body.truncated,
  };
}
