import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// unstable_cache is replaced by a pass-through that records how it was called,
// so the wrappers' cache keys and TTL are asserted without a Next runtime.
// Recorded in a hoisted array, not mock.calls: tests/setup.tsx clears every
// mock after each test, and these registrations happen once, at import.
const cacheRegistrations = vi.hoisted(() => [] as Array<{ keyParts: unknown; options: unknown }>);
vi.mock("next/cache", () => ({
  unstable_cache: (fn: unknown, keyParts: unknown, options: unknown) => {
    cacheRegistrations.push({ keyParts, options });
    return fn;
  },
}));

import {
  npRequest,
  searchCities,
  searchWarehouses,
  cachedSearchCities,
  cachedSearchWarehouses,
  normalizeQuery,
  NovaPoshtaError,
  NovaPoshtaRateLimitError,
  setNpMinSpacingMs,
  NP_MIN_SPACING_MS,
  NP_API_URL,
  NP_POSTOMAT_TYPE_REF,
  MAX_RESULTS,
} from "@/lib/nova-poshta";
import { NP_REF_PATTERN, formatNpArea } from "@/lib/nova-poshta-shared";
import {
  KYIV_CITY_REF,
  RAW_CITY_KYIV,
  RAW_CITY_KYIVETS,
  RAW_BRANCH_1,
  RAW_DROPOFF_920,
  RAW_POSTOMAT_1001,
  RAW_STORE_KYBLIARY,
  RAW_BRANCH_DENIED,
  RAW_BRANCH_CLOSED,
  MIXED_WAREHOUSES,
  npEnvelope,
  NP_KEY_EXPIRED,
} from "../fixtures/nova-poshta";

const fetchMock = vi.fn();
let warnSpy: ReturnType<typeof vi.spyOn>;
const originalKey = process.env.NOVAPOSHTA_API_KEY;

function respond(body: unknown, status = 200) {
  fetchMock.mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });
}

function sentBody(call = 0) {
  return JSON.parse(fetchMock.mock.calls[call][1].body as string);
}

beforeEach(() => {
  // mockReset, not clearAllMocks: a leftover mockResolvedValueOnce would leak
  // into the next test (project memory: vitest once-queues leak).
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  delete process.env.NOVAPOSHTA_API_KEY;
  // The per-instance call spacing is off for every test but its own describe: a
  // module-level slot would otherwise leak real waiting between unrelated tests.
  setNpMinSpacingMs(0);
  // npRequest logs every failure it throws; keep the test output pristine.
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  warnSpy.mockRestore();
  if (originalKey === undefined) delete process.env.NOVAPOSHTA_API_KEY;
  else process.env.NOVAPOSHTA_API_KEY = originalKey;
});

describe("npRequest", () => {
  it("posts the classic envelope with an empty key when none is configured", async () => {
    respond(npEnvelope([RAW_CITY_KYIV]));
    await npRequest("Address", "getCities", { FindByString: "київ" });

    expect(fetchMock.mock.calls[0][0]).toBe(NP_API_URL);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: "POST", cache: "no-store" });
    expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
    expect(sentBody()).toEqual({
      apiKey: "",
      modelName: "Address",
      calledMethod: "getCities",
      methodProperties: { FindByString: "київ" },
    });
  });

  it("sends NOVAPOSHTA_API_KEY when it is set", async () => {
    process.env.NOVAPOSHTA_API_KEY = "test-key";
    respond(npEnvelope([]));
    await npRequest("Address", "getCities", {});
    expect(sentBody().apiKey).toBe("test-key");
  });

  it("returns the data and NP's totalCount", async () => {
    respond(npEnvelope([RAW_CITY_KYIV], 2));
    await expect(npRequest("Address", "getCities", {})).resolves.toEqual({
      data: [RAW_CITY_KYIV],
      totalCount: 2,
    });
  });

  it("raises NovaPoshtaError carrying NP's message on success: false (an expired key)", async () => {
    respond(NP_KEY_EXPIRED);
    const call = npRequest("Address", "getCities", {});
    await expect(call).rejects.toThrow(NovaPoshtaError);
    respond(NP_KEY_EXPIRED);
    await expect(npRequest("Address", "getCities", {})).rejects.toThrow(/API key expired/);
  });

  it("raises when data is not an array", async () => {
    respond({ success: true, data: null, errors: [] });
    await expect(npRequest("Address", "getCities", {})).rejects.toThrow(NovaPoshtaError);
  });

  it("raises on a non-2xx status", async () => {
    respond({}, 503);
    await expect(npRequest("Address", "getCities", {})).rejects.toThrow(/HTTP 503/);
  });

  it("raises on a network error or timeout", async () => {
    fetchMock.mockRejectedValueOnce(new DOMException("The operation timed out.", "TimeoutError"));
    await expect(npRequest("Address", "getCities", {})).rejects.toThrow(NovaPoshtaError);
  });

  it("raises on an unparseable body", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError("Unexpected token <");
      },
    });
    await expect(npRequest("Address", "getCities", {})).rejects.toThrow(NovaPoshtaError);
  });
});

// NP sporadically throttles keyed calls with success:false (live 2026-10-05):
// «To many requests» (NP's own typo) or «Try again after 0.5 seconds».
const NP_THROTTLED = {
  success: false,
  data: [],
  errors: ["To many requests"],
  warnings: [],
  info: [],
};
const npTryAfter = (seconds: string) => ({
  ...NP_THROTTLED,
  errors: [`Try again after ${seconds} seconds`],
});

describe("npRequest rate-limit handling", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("retries once after a throttle and returns the second answer", async () => {
    respond(NP_THROTTLED);
    respond(npEnvelope([RAW_CITY_KYIV]));
    const call = npRequest("Address", "getWarehouses", {});
    await vi.advanceTimersByTimeAsync(600);
    await expect(call).resolves.toMatchObject({ data: [RAW_CITY_KYIV] });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sentBody(1)).toEqual(sentBody(0)); // the SAME request
    expect(warnSpy).not.toHaveBeenCalled(); // a recovered call is not a failure
  });

  it("recovers on the third attempt, and throws NovaPoshtaRateLimitError after the third throttle", async () => {
    respond(NP_THROTTLED);
    respond(NP_THROTTLED);
    respond(npEnvelope([]));
    const recovered = npRequest("Address", "getWarehouses", {});
    await vi.advanceTimersByTimeAsync(1500);
    await expect(recovered).resolves.toMatchObject({ data: [] });
    expect(fetchMock).toHaveBeenCalledTimes(3);

    fetchMock.mockReset();
    respond(NP_THROTTLED);
    respond(NP_THROTTLED);
    respond(NP_THROTTLED);
    const exhausted = npRequest("Address", "getWarehouses", {});
    const assertion = expect(exhausted).rejects.toThrow(/^NP rate limit: To many requests$/);
    await vi.advanceTimersByTimeAsync(3000);
    await assertion;
    expect(fetchMock).toHaveBeenCalledTimes(3); // 3 attempts total, never a fourth
    await expect(exhausted).rejects.toBeInstanceOf(NovaPoshtaRateLimitError);
    await expect(exhausted).rejects.toBeInstanceOf(NovaPoshtaError);
  });

  it("honours NP's hint, clamped to 0.3-1.5 s, and defaults to 0.6 s", async () => {
    const waited = async (first: unknown) => {
      fetchMock.mockReset();
      respond(first);
      respond(npEnvelope([]));
      const call = npRequest("Address", "getWarehouses", {});
      await vi.advanceTimersByTimeAsync(0);
      return { call, calls: () => fetchMock.mock.calls.length };
    };

    // hint 0.5 s → exactly 500 ms
    let r = await waited(npTryAfter("0.5"));
    await vi.advanceTimersByTimeAsync(499);
    expect(r.calls()).toBe(1);
    await vi.advanceTimersByTimeAsync(1);
    await r.call;
    expect(r.calls()).toBe(2);

    // hint 0.05 s → clamped up to 300 ms
    r = await waited(npTryAfter("0.05"));
    await vi.advanceTimersByTimeAsync(299);
    expect(r.calls()).toBe(1);
    await vi.advanceTimersByTimeAsync(1);
    await r.call;

    // hint 30 s → clamped down to 1500 ms
    r = await waited(npTryAfter("30"));
    await vi.advanceTimersByTimeAsync(1499);
    expect(r.calls()).toBe(1);
    await vi.advanceTimersByTimeAsync(1);
    await r.call;

    // no hint → 600 ms
    r = await waited(NP_THROTTLED);
    await vi.advanceTimersByTimeAsync(599);
    expect(r.calls()).toBe(1);
    await vi.advanceTimersByTimeAsync(1);
    await r.call;
  });

  it("does not start a retry once more than 5 s have passed since the first attempt", async () => {
    fetchMock.mockImplementationOnce(async () => {
      vi.setSystemTime(Date.now() + 6000); // a slow first answer
      return { ok: true, status: 200, json: async () => NP_THROTTLED };
    });
    const call = npRequest("Address", "getWarehouses", {});
    const assertion = expect(call).rejects.toBeInstanceOf(NovaPoshtaRateLimitError);
    await vi.advanceTimersByTimeAsync(2000);
    await assertion;
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("never retries any other failure — a dead key fails fast", async () => {
    respond(NP_KEY_EXPIRED);
    await expect(npRequest("Address", "getCities", {})).rejects.toThrow(/API key expired/);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fetchMock.mockReset();
    respond({}, 503);
    await expect(npRequest("Address", "getCities", {})).rejects.toThrow(/HTTP 503/);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fetchMock.mockReset();
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));
    await expect(npRequest("Address", "getCities", {})).rejects.toThrow(/fetch failed/);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // An expired-key throw is a plain NovaPoshtaError, not the rate-limit subclass.
    fetchMock.mockReset();
    respond(NP_KEY_EXPIRED);
    await expect(npRequest("Address", "getCities", {})).rejects.not.toBeInstanceOf(
      NovaPoshtaRateLimitError
    );
  });

  it("logs one [np] request failed warning with the method and NP's reason, never the key", async () => {
    process.env.NOVAPOSHTA_API_KEY = "sk-secret-np-key-123";
    respond(NP_KEY_EXPIRED);
    let thrown: unknown;
    try {
      await npRequest("Address", "getWarehouses", {});
    } catch (error) {
      thrown = error;
    }
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith("[np] request failed", {
      method: "getWarehouses",
      reason: "NP error: API key expired",
    });
    expect(JSON.stringify(warnSpy.mock.calls)).not.toContain("sk-secret-np-key-123");
    expect(String((thrown as Error).message)).not.toContain("sk-secret-np-key-123");

    // exhausted throttling logs once too (not once per attempt)
    warnSpy.mockClear();
    respond(NP_THROTTLED);
    respond(NP_THROTTLED);
    respond(NP_THROTTLED);
    const call = npRequest("Address", "getWarehouses", {});
    const assertion = expect(call).rejects.toBeInstanceOf(NovaPoshtaRateLimitError);
    await vi.advanceTimersByTimeAsync(3000);
    await assertion;
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith("[np] request failed", {
      method: "getWarehouses",
      reason: "NP rate limit: To many requests",
    });
  });
});

describe("npRequest rate-limit hint on the thrown error (A1)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  async function exhaustedWith(throttled: unknown) {
    respond(throttled);
    respond(throttled);
    respond(throttled);
    const call = npRequest("Address", "getWarehouses", {});
    const settled = call.then(
      () => null,
      (error: unknown) => error
    );
    await vi.advanceTimersByTimeAsync(5000);
    return (await settled) as NovaPoshtaRateLimitError;
  }

  it("carries the clamped hint of the LAST throttled answer", async () => {
    expect((await exhaustedWith(npTryAfter("0.5"))).retryAfterMs).toBe(500);
    fetchMock.mockReset();
    expect((await exhaustedWith(npTryAfter("0.05"))).retryAfterMs).toBe(300);
    fetchMock.mockReset();
    expect((await exhaustedWith(npTryAfter("30"))).retryAfterMs).toBe(1500);
    fetchMock.mockReset();
    expect((await exhaustedWith(NP_THROTTLED)).retryAfterMs).toBe(600);
  });

  it("uses the last answer's hint when the hints differ between attempts", async () => {
    respond(npTryAfter("0.4"));
    respond(npTryAfter("0.4"));
    respond(npTryAfter("1.2"));
    const call = npRequest("Address", "getWarehouses", {});
    const settled = call.then(
      () => null,
      (error: unknown) => error
    );
    await vi.advanceTimersByTimeAsync(5000);
    const error = (await settled) as NovaPoshtaRateLimitError;
    expect(error).toBeInstanceOf(NovaPoshtaRateLimitError);
    expect(error.retryAfterMs).toBe(1200);
  });
});

describe("npRequest call spacing (B2)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-05T10:00:00Z"));
    setNpMinSpacingMs(NP_MIN_SPACING_MS); // also resets the slot
  });
  afterEach(() => vi.useRealTimers());

  it("defaults to 150 ms", () => {
    expect(NP_MIN_SPACING_MS).toBe(150);
  });

  it("staggers the STARTS of concurrent calls at least the spacing apart", async () => {
    const startedAt: number[] = [];
    fetchMock.mockImplementation(async () => {
      startedAt.push(Date.now());
      return { ok: true, status: 200, json: async () => npEnvelope([]) };
    });
    const calls = [0, 1, 2, 3].map(() => npRequest("Address", "getWarehouses", {}));
    await vi.advanceTimersByTimeAsync(0);
    expect(startedAt).toHaveLength(1); // the first goes at once, the rest wait for their slot
    await vi.advanceTimersByTimeAsync(1000);
    await Promise.all(calls);
    expect(startedAt).toHaveLength(4);
    for (let i = 1; i < startedAt.length; i++) {
      expect(startedAt[i] - startedAt[i - 1]).toBeGreaterThanOrEqual(NP_MIN_SPACING_MS);
    }
  });

  it("does not serialise response handling: a slow answer does not hold the next start", async () => {
    const startedAt: number[] = [];
    fetchMock.mockImplementation(async () => {
      startedAt.push(Date.now());
      await new Promise((resolve) => setTimeout(resolve, 5000)); // a slow NP answer
      return { ok: true, status: 200, json: async () => npEnvelope([]) };
    });
    const calls = [0, 1, 2].map(() => npRequest("Address", "getWarehouses", {}));
    await vi.advanceTimersByTimeAsync(NP_MIN_SPACING_MS * 2);
    expect(startedAt).toHaveLength(3); // all three started long before the first answered
    await vi.advanceTimersByTimeAsync(6000);
    await Promise.all(calls);
  });

  it("spaces in-server retries through the same gate", async () => {
    const startedAt: number[] = [];
    let n = 0;
    fetchMock.mockImplementation(async () => {
      startedAt.push(Date.now());
      return {
        ok: true,
        status: 200,
        json: async () => (n++ === 0 ? npTryAfter("0.3") : npEnvelope([])),
      };
    });
    const a = npRequest("Address", "getWarehouses", {});
    const b = npRequest("Address", "getWarehouses", {});
    await vi.advanceTimersByTimeAsync(2000);
    await Promise.all([a, b]);
    expect(startedAt).toHaveLength(3);
    for (let i = 1; i < startedAt.length; i++) {
      expect(startedAt[i] - startedAt[i - 1]).toBeGreaterThanOrEqual(NP_MIN_SPACING_MS);
    }
  });

  it("a spacing of 0 disables the stagger", async () => {
    setNpMinSpacingMs(0);
    fetchMock.mockImplementation(async () => ({
      ok: true,
      status: 200,
      json: async () => npEnvelope([]),
    }));
    const calls = [0, 1, 2, 3].map(() => npRequest("Address", "getWarehouses", {}));
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(4);
    await Promise.all(calls);
  });
});

describe("normalizeQuery", () => {
  it("trims, collapses whitespace and lower-cases", () => {
    expect(normalizeQuery("  Біла   Церква ")).toBe("біла церква");
  });

  it("normalises Russian input — NP matches Russian names too", () => {
    expect(normalizeQuery("Киев")).toBe("киев");
  });

  // NP spells names with the ASCII apostrophe only: live, keyless 2026-10-05, «кам'янське»
  // (U+0027) answers 5 cities and the U+2019 / U+02BC spellings answer success:true with [].
  it.each([
    ["U+2019", "\u2019"],
    ["U+02BC", "\u02BC"],
    ["U+2018", "\u2018"],
    ["U+02BB", "\u02BB"],
    ["grave U+0060", "\u0060"],
    ["acute U+00B4", "\u00B4"],
    ["ASCII U+0027", "\u0027"],
  ])("maps the %s apostrophe to U+0027", (_label, apostrophe) => {
    expect(normalizeQuery(`Кам${apostrophe}янське`)).toBe("кам\u0027янське");
  });
});

describe("searchCities", () => {
  it("asks getCities for 20 matches of the normalised query and maps the fields", async () => {
    respond(npEnvelope([RAW_CITY_KYIV, RAW_CITY_KYIVETS]));
    const cities = await searchCities("  Київ ");

    expect(sentBody()).toMatchObject({
      modelName: "Address",
      calledMethod: "getCities",
      methodProperties: { FindByString: "київ", Limit: "20" },
    });
    expect(cities).toEqual([
      { ref: KYIV_CITY_REF, name: "Київ", area: "Київська" },
      { ref: RAW_CITY_KYIVETS.Ref, name: "Київець", area: "Львівська" },
    ]);
  });
});

describe("searchCities — queries NP cannot search (I1)", () => {
  // Live, keyless: FindByString "Kyiv", "ky", "rb]d" (Київ typed on an EN layout) or "--"
  // answers success:false / "FindByString is not specified", which npRequest turns into a
  // NovaPoshtaError and the checkout into a false «довідник недоступний» fallback. A query
  // with no Cyrillic letter and no digit can match no city, so it never reaches NP.
  it.each(["Kyiv", "ky", "rb]d", "--", "  Lviv  "])(
    "answers [] without calling NP for %j (no Cyrillic letter, no digit)",
    async (q) => {
      await expect(searchCities(q)).resolves.toEqual([]);
      expect(fetchMock).not.toHaveBeenCalled();
    }
  );

  it("sends a typographic apostrophe to NP as the ASCII one", async () => {
    respond(npEnvelope([]));
    await searchCities("Слов\u2019янськ");
    expect(sentBody().methodProperties.FindByString).toBe("слов\u0027янськ");
  });

  it("still answers [] without calling NP for a query of apostrophes only", async () => {
    await expect(searchCities("\u2019\u02BC\u0027")).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("is shared by the cached wrapper", async () => {
    await expect(cachedSearchCities("Kyiv")).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(["київ", "Киев", "12", "кb", "b1"])("still calls NP for %j", async (q) => {
    respond(npEnvelope([]));
    await expect(searchCities(q)).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sentBody().methodProperties.FindByString).toBe(q.toLowerCase());
  });
});

describe("searchWarehouses — branch", () => {
  it("keeps Branch, DropOff and Store; drops Postomat, Fulfillment and unselectable rows", async () => {
    respond(npEnvelope(MIXED_WAREHOUSES));
    const result = await searchWarehouses(KYIV_CITY_REF, "branch", "");

    expect(result.items.map((w) => w.ref)).toEqual([
      RAW_BRANCH_1.Ref,
      RAW_DROPOFF_920.Ref,
      RAW_STORE_KYBLIARY.Ref,
    ]);
    expect(result.items[0]).toEqual({
      ref: RAW_BRANCH_1.Ref,
      number: "1",
      name: RAW_BRANCH_1.Description,
    });
  });

  it("drops a DenyToSelect row and a non-Working row explicitly", async () => {
    respond(npEnvelope([RAW_BRANCH_DENIED, RAW_BRANCH_CLOSED]));
    const result = await searchWarehouses(KYIV_CITY_REF, "branch", "");
    expect(result.items).toEqual([]);
  });

  it("requests 500 rows without a type filter, and sends no FindByString for an empty query", async () => {
    respond(npEnvelope([]));
    await searchWarehouses(KYIV_CITY_REF, "branch", "  ");
    expect(sentBody().methodProperties).toEqual({ CityRef: KYIV_CITY_REF, Limit: "500" });
  });

  it("sends the normalised query as FindByString", async () => {
    respond(npEnvelope([]));
    await searchWarehouses(KYIV_CITY_REF, "branch", " Хрещатик ");
    expect(sentBody().methodProperties.FindByString).toBe("хрещатик");
  });

  it("sends a typographic apostrophe in the query as the ASCII one", async () => {
    respond(npEnvelope([]));
    await searchWarehouses(KYIV_CITY_REF, "branch", "Сім\u2019ї");
    expect(sentBody().methodProperties.FindByString).toBe("сім\u0027ї");
  });

  it("caps at 50 and marks the result truncated", async () => {
    const many = Array.from({ length: 60 }, (_, i) => ({
      ...RAW_BRANCH_1,
      Ref: `00000000-0000-0000-0000-${String(i).padStart(12, "0")}`,
      Number: String(i + 1),
    }));
    respond(npEnvelope(many));
    const result = await searchWarehouses(KYIV_CITY_REF, "branch", "");
    expect(result.items).toHaveLength(MAX_RESULTS);
    expect(result.truncated).toBe(true);
  });

  it("marks truncated when NP matched more rows than it returned", async () => {
    respond(npEnvelope([RAW_BRANCH_1], 900));
    const result = await searchWarehouses(KYIV_CITY_REF, "branch", "1");
    expect(result.items).toHaveLength(1);
    expect(result.truncated).toBe(true);
  });

  it("is not truncated when everything fits", async () => {
    respond(npEnvelope([RAW_BRANCH_1]));
    expect((await searchWarehouses(KYIV_CITY_REF, "branch", "")).truncated).toBe(false);
  });
});

describe("searchWarehouses — postomat", () => {
  it("filters on NP's side by the postomat type and asks for 50", async () => {
    respond(npEnvelope([RAW_POSTOMAT_1001]));
    await searchWarehouses(KYIV_CITY_REF, "postomat", "");
    expect(sentBody().methodProperties).toEqual({
      CityRef: KYIV_CITY_REF,
      TypeOfWarehouseRef: NP_POSTOMAT_TYPE_REF,
      Limit: "50",
    });
  });

  it("keeps only Postomat rows even if NP's filter lets others through", async () => {
    respond(npEnvelope(MIXED_WAREHOUSES));
    const result = await searchWarehouses(KYIV_CITY_REF, "postomat", "");
    expect(result.items.map((w) => w.ref)).toEqual([RAW_POSTOMAT_1001.Ref]);
  });
});

describe("cached wrappers", () => {
  it("register a daily unstable_cache per search", () => {
    expect(cacheRegistrations).toEqual(
      expect.arrayContaining([
        { keyParts: ["np-cities-v1"], options: { revalidate: 86_400 } },
        { keyParts: ["np-warehouses-v1"], options: { revalidate: 86_400 } },
      ])
    );
  });

  it("normalise before the cache, so equivalent queries share one entry", async () => {
    respond(npEnvelope([RAW_CITY_KYIV]));
    await cachedSearchCities("  КИЇВ ");
    expect(sentBody().methodProperties.FindByString).toBe("київ");

    respond(npEnvelope([]));
    await cachedSearchWarehouses(KYIV_CITY_REF, "branch", " 135 ");
    expect(sentBody(1).methodProperties.FindByString).toBe("135");
  });

  it("queries differing only by apostrophe form pass one identical argument to the cache", async () => {
    // The unstable_cache stub is a pass-through, so the argument the wrapper hands the
    // cache is the one the underlying function sends to NP as FindByString.
    respond(npEnvelope([RAW_CITY_KYIV]));
    await cachedSearchCities("Кам\u2019янське");
    respond(npEnvelope([RAW_CITY_KYIV]));
    await cachedSearchCities("Кам\u02BCянське");
    expect(sentBody(0).methodProperties.FindByString).toBe("кам\u0027янське");
    expect(sentBody(1).methodProperties.FindByString).toBe(
      sentBody(0).methodProperties.FindByString
    );

    respond(npEnvelope([]));
    await cachedSearchWarehouses(KYIV_CITY_REF, "branch", "Сім\u2019ї");
    respond(npEnvelope([]));
    await cachedSearchWarehouses(KYIV_CITY_REF, "branch", "Сім\u02BCї");
    expect(sentBody(3).methodProperties.FindByString).toBe(
      sentBody(2).methodProperties.FindByString
    );
  });

  it("lower-case the city ref before the cache, so one city shares one entry (M5)", async () => {
    respond(npEnvelope([]));
    await cachedSearchWarehouses(KYIV_CITY_REF.toUpperCase(), "branch", "");
    expect(sentBody().methodProperties.CityRef).toBe(KYIV_CITY_REF);
  });
});

describe("nova-poshta-shared", () => {
  it("NP_REF_PATTERN accepts NP refs and rejects anything else", () => {
    expect(NP_REF_PATTERN.test(KYIV_CITY_REF)).toBe(true);
    expect(NP_REF_PATTERN.test(RAW_POSTOMAT_1001.Ref)).toBe(true);
    expect(NP_REF_PATTERN.test("8d5a980d391c11dd90d9001a92567626")).toBe(false);
    expect(NP_REF_PATTERN.test("not-a-ref")).toBe(false);
  });

  it("formatNpArea appends «обл.» and leaves an empty area empty", () => {
    expect(formatNpArea("Київська")).toBe("Київська обл.");
    expect(formatNpArea("")).toBe("");
  });
});
