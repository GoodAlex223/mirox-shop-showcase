import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  fetchNpCities,
  fetchNpWarehouses,
  NpDirectoryError,
  __resetNpCooldown,
} from "@/components/checkout/np-directory";
import { API_CITIES, API_BRANCHES, KYIV_CITY_REF, RAW_BRANCH_1 } from "../fixtures/nova-poshta";

const fetchMock = vi.fn();
const signal = new AbortController().signal;

function respond(body: unknown, status = 200, headers: Record<string, string> = {}) {
  fetchMock.mockResolvedValueOnce({
    ok: status === 200,
    status,
    json: async () => body,
    headers: new Headers(headers),
  });
}

const busy = (retryAfterMs?: number, headers?: Record<string, string>) =>
  respond(
    {
      error: "Nova Poshta is busy",
      code: "NP_BUSY",
      ...(retryAfterMs !== undefined && { retryAfterMs }),
    },
    503,
    headers
  );

beforeEach(() => {
  __resetNpCooldown();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("fetchNpCities", () => {
  it("calls our route with the encoded query and maps cities to options", async () => {
    respond(API_CITIES);
    const page = await fetchNpCities("Біла Ц", signal);

    expect(fetchMock).toHaveBeenCalledWith(
      `/api/shipping/np/cities?q=${encodeURIComponent("Біла Ц")}`,
      { signal }
    );
    expect(page).toEqual({
      options: [{ value: KYIV_CITY_REF, label: "Київ", description: "Київська обл." }],
      truncated: false,
    });
  });

  it("throws NpDirectoryError on a non-200", async () => {
    respond({ code: "NP_UNAVAILABLE" }, 404);
    await expect(fetchNpCities("Київ", signal)).rejects.toThrow(NpDirectoryError);
  });

  it("settles a 400 as an empty page, not as a failure (I1: the route refused the query, NP is fine)", async () => {
    respond({ code: "VALIDATION_ERROR" }, 400);
    await expect(fetchNpCities("Київ", signal)).resolves.toEqual({ options: [], truncated: false });
  });

  it("still throws on a 404 (no retry), and on a 500 / network error that persists through the retry", async () => {
    respond({}, 404);
    await expect(fetchNpCities("Київ", signal)).rejects.toThrow(NpDirectoryError);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    vi.useFakeTimers();
    try {
      respond({ code: "SEARCH_FAILED" }, 500);
      respond({ code: "SEARCH_FAILED" }, 500);
      const serverError = expect(fetchNpCities("Київ", signal)).rejects.toThrow(NpDirectoryError);
      await vi.advanceTimersByTimeAsync(700);
      await serverError;

      fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
      fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
      const network = expect(fetchNpCities("Київ", signal)).rejects.toThrow(TypeError);
      await vi.advanceTimersByTimeAsync(700);
      await network;
    } finally {
      vi.useRealTimers();
    }
  });

  it("rejects a 200 with an unexpected body", async () => {
    respond({ items: [{ ref: 1, name: "Київ" }] });
    await expect(fetchNpCities("Київ", signal)).rejects.toThrow(NpDirectoryError);
    respond({ cities: [] });
    await expect(fetchNpCities("Київ", signal)).rejects.toThrow(NpDirectoryError);
  });
});

describe("fetchNpWarehouses", () => {
  it("calls our route with city, kind and query, and maps points to options", async () => {
    respond(API_BRANCHES);
    const page = await fetchNpWarehouses(KYIV_CITY_REF, "branch", "", signal);

    const url = new URL(fetchMock.mock.calls[0][0] as string, "http://localhost");
    expect(url.pathname).toBe("/api/shipping/np/warehouses");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      city: KYIV_CITY_REF,
      kind: "branch",
      q: "",
    });
    expect(page.options[0]).toEqual({ value: RAW_BRANCH_1.Ref, label: RAW_BRANCH_1.Description });
    expect(page.truncated).toBe(false);
  });

  it("settles a 400 as an empty page, not as a failure (I1/I2)", async () => {
    respond({ code: "VALIDATION_ERROR" }, 400);
    await expect(fetchNpWarehouses(KYIV_CITY_REF, "branch", "x", signal)).resolves.toEqual({
      options: [],
      truncated: false,
    });
  });

  it("still throws on a 502 that persists through the retry", async () => {
    vi.useFakeTimers();
    try {
      respond({ code: "NP_UNAVAILABLE" }, 502);
      respond({ code: "NP_UNAVAILABLE" }, 502);
      const failed = expect(fetchNpWarehouses(KYIV_CITY_REF, "branch", "", signal)).rejects.toThrow(
        NpDirectoryError
      );
      await vi.advanceTimersByTimeAsync(700);
      await failed;
    } finally {
      vi.useRealTimers();
    }
  });

  it("rejects a body without a boolean truncated flag", async () => {
    respond({ items: [] });
    await expect(fetchNpWarehouses(KYIV_CITY_REF, "branch", "", signal)).rejects.toThrow(
      NpDirectoryError
    );
  });
});

describe("transient-failure retry (NP throttling surfaces as a 502)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("retries once after a 502 and resolves with the second body", async () => {
    respond({ code: "NP_UNAVAILABLE" }, 502);
    respond(API_BRANCHES);
    const pending = fetchNpWarehouses(KYIV_CITY_REF, "branch", "", signal);
    await vi.advanceTimersByTimeAsync(699);
    expect(fetchMock).toHaveBeenCalledTimes(1); // still waiting out the delay
    await vi.advanceTimersByTimeAsync(1);
    const page = await pending;
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(page.options[0]).toEqual({ value: RAW_BRANCH_1.Ref, label: RAW_BRANCH_1.Description });
  });

  it("retries once after a network error and resolves", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    respond(API_CITIES);
    const pending = fetchNpCities("Київ", signal);
    await vi.advanceTimersByTimeAsync(700);
    await expect(pending).resolves.toMatchObject({ options: [{ value: KYIV_CITY_REF }] });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("gives up with NpDirectoryError after exactly two calls when the 502 persists", async () => {
    respond({ code: "NP_UNAVAILABLE" }, 502);
    respond({ code: "NP_UNAVAILABLE" }, 502);
    const failed = expect(fetchNpCities("Київ", signal)).rejects.toThrow(NpDirectoryError);
    await vi.advanceTimersByTimeAsync(5000);
    await failed;
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry when the signal aborts during the wait", async () => {
    const controller = new AbortController();
    respond({ code: "NP_UNAVAILABLE" }, 502);
    const pending = fetchNpCities("Київ", controller.signal);
    const assertion = expect(pending).rejects.toMatchObject({ name: "AbortError" });
    await vi.advanceTimersByTimeAsync(300);
    controller.abort();
    await assertion;
    await vi.advanceTimersByTimeAsync(5000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not retry an aborted fetch", async () => {
    const controller = new AbortController();
    fetchMock.mockImplementationOnce(async () => {
      controller.abort();
      throw new DOMException("The operation was aborted.", "AbortError");
    });
    const assertion = expect(fetchNpCities("Київ", controller.signal)).rejects.toMatchObject({
      name: "AbortError",
    });
    await vi.advanceTimersByTimeAsync(5000);
    await assertion;
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("settles a 400 as an empty page with no retry, and a 404 throws with no retry", async () => {
    respond({ code: "VALIDATION_ERROR" }, 400);
    await expect(fetchNpCities("Київ", signal)).resolves.toEqual({ options: [], truncated: false });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fetchMock.mockReset();
    respond({}, 404);
    await expect(fetchNpCities("Київ", signal)).rejects.toThrow(NpDirectoryError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("pausing on Nova Poshta's busy hint (503 NP_BUSY)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("waits out the hint, retries, and resolves with the 200 body", async () => {
    busy(900);
    respond(API_CITIES);
    const startedAt = Date.now();
    const pending = fetchNpCities("Київ", signal);
    await vi.advanceTimersByTimeAsync(899);
    expect(fetchMock).toHaveBeenCalledTimes(1); // still pausing
    await vi.advanceTimersByTimeAsync(1);
    await expect(pending).resolves.toMatchObject({ options: [{ value: KYIV_CITY_REF }] });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(Date.now() - startedAt).toBeGreaterThanOrEqual(900);
  });

  it("gives up with NpDirectoryError after exactly three calls when it stays busy", async () => {
    busy(300);
    busy(300);
    busy(300);
    const failed = expect(fetchNpCities("Київ", signal)).rejects.toThrow(NpDirectoryError);
    await vi.advanceTimersByTimeAsync(10_000);
    await failed;
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("falls back to the Retry-After header (seconds) when the body has no hint", async () => {
    busy(undefined, { "Retry-After": "2" });
    respond(API_CITIES);
    const pending = fetchNpCities("Київ", signal);
    await vi.advanceTimersByTimeAsync(1999);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await pending;
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("uses 800 ms when neither the body nor the header carries a hint", async () => {
    busy();
    respond(API_CITIES);
    const pending = fetchNpCities("Київ", signal);
    await vi.advanceTimersByTimeAsync(799);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await pending;
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it.each([
    [50, 300],
    [60_000, 3000],
  ])("clamps a hint of %i ms to %i ms", async (hint, expected) => {
    busy(hint);
    respond(API_CITIES);
    const pending = fetchNpCities("Київ", signal);
    await vi.advanceTimersByTimeAsync(expected - 1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await pending;
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("shares the cooldown: the NEXT call, even of the other fetcher, waits for it", async () => {
    busy(1000);
    busy(1000);
    busy(1000);
    const failed = expect(fetchNpCities("Київ", signal)).rejects.toThrow(NpDirectoryError);
    await vi.advanceTimersByTimeAsync(2000); // pauses at t=0 and t=1000, third BUSY at t=2000
    await failed;
    expect(fetchMock).toHaveBeenCalledTimes(3);

    // The last BUSY set a fresh 1000 ms cooldown just now.
    fetchMock.mockClear();
    respond(API_BRANCHES);
    const next = fetchNpWarehouses(KYIV_CITY_REF, "branch", "", signal);
    await vi.advanceTimersByTimeAsync(999);
    expect(fetchMock).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await next;
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("a call started with no cooldown running goes out at once", async () => {
    respond(API_CITIES);
    await fetchNpCities("Київ", signal);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("sends nothing when the signal aborts during the cooldown wait", async () => {
    busy(1000);
    busy(1000);
    busy(1000);
    const failed = expect(fetchNpCities("Київ", signal)).rejects.toThrow(NpDirectoryError);
    await vi.advanceTimersByTimeAsync(2000); // pauses at t=0 and t=1000, third BUSY at t=2000
    await failed;
    fetchMock.mockClear();

    const controller = new AbortController();
    const next = expect(fetchNpCities("Київ", controller.signal)).rejects.toMatchObject({
      name: "AbortError",
    });
    await vi.advanceTimersByTimeAsync(400);
    controller.abort();
    await next;
    await vi.advanceTimersByTimeAsync(5000);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends nothing when the signal is already aborted while a cooldown runs", async () => {
    busy(1000);
    busy(1000);
    busy(1000);
    const failed = expect(fetchNpCities("Київ", signal)).rejects.toThrow(NpDirectoryError);
    await vi.advanceTimersByTimeAsync(2000); // pauses at t=0 and t=1000, third BUSY at t=2000
    await failed;
    fetchMock.mockClear();

    const controller = new AbortController();
    controller.abort();
    await expect(fetchNpCities("Київ", controller.signal)).rejects.toMatchObject({
      name: "AbortError",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("a plain 502 still gets exactly one retry (no BUSY handling)", async () => {
    respond({ code: "NP_UNAVAILABLE" }, 502);
    respond({ code: "NP_UNAVAILABLE" }, 502);
    const failed = expect(fetchNpCities("Київ", signal)).rejects.toThrow(NpDirectoryError);
    await vi.advanceTimersByTimeAsync(10_000);
    await failed;
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("treats a 503 WITHOUT the NP_BUSY code as a generic 5xx: one retry", async () => {
    respond({ code: "SOMETHING_ELSE" }, 503);
    respond({ code: "SOMETHING_ELSE" }, 503);
    const failed = expect(fetchNpCities("Київ", signal)).rejects.toThrow(NpDirectoryError);
    await vi.advanceTimersByTimeAsync(10_000);
    await failed;
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("budgets BUSY retries and the generic retry separately, never past four calls", async () => {
    busy(300);
    busy(300);
    respond({ code: "NP_UNAVAILABLE" }, 502);
    respond({ code: "NP_UNAVAILABLE" }, 502);
    respond({ code: "NP_UNAVAILABLE" }, 502); // must never be requested
    const failed = expect(fetchNpCities("Київ", signal)).rejects.toThrow(NpDirectoryError);
    await vi.advanceTimersByTimeAsync(20_000);
    await failed;
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("a generic network failure after BUSY retries still gets its one retry and can recover", async () => {
    busy(300);
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    respond(API_CITIES);
    const pending = fetchNpCities("Київ", signal);
    await vi.advanceTimersByTimeAsync(5000);
    await expect(pending).resolves.toMatchObject({ options: [{ value: KYIV_CITY_REF }] });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("an abort during the BUSY pause rejects with the abort and sends nothing more", async () => {
    const controller = new AbortController();
    busy(1000);
    const pending = expect(fetchNpCities("Київ", controller.signal)).rejects.toMatchObject({
      name: "AbortError",
    });
    await vi.advanceTimersByTimeAsync(500);
    controller.abort();
    await pending;
    await vi.advanceTimersByTimeAsync(5000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects with the abort, not NpDirectoryError, when the signal aborts while a 503 body is being read", async () => {
    const controller = new AbortController();
    respond({ code: "NP_UNAVAILABLE" }, 502); // spends the one generic retry
    let finishRead!: () => void;
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 503,
      headers: new Headers(),
      json: () =>
        new Promise((resolve) => {
          finishRead = () => resolve({ code: "SOMETHING_ELSE" });
        }),
    });
    const pending = fetchNpCities("Київ", controller.signal);
    const settled = pending.then(
      () => null,
      (error: unknown) => error
    );
    await vi.advanceTimersByTimeAsync(700); // the retry fires; its answer is mid-read
    expect(fetchMock).toHaveBeenCalledTimes(2);
    controller.abort();
    finishRead();
    const error = await settled;
    expect(error).toMatchObject({ name: "AbortError" });
    expect(error).not.toBeInstanceOf(NpDirectoryError);
  });

  it("rejects with the abort when it fires while the third BUSY answer is being read", async () => {
    const controller = new AbortController();
    busy(300);
    busy(300);
    let finishRead!: () => void;
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 503,
      headers: new Headers(),
      json: () =>
        new Promise((resolve) => {
          finishRead = () => resolve({ code: "NP_BUSY", retryAfterMs: 300 });
        }),
    });
    const settled = fetchNpCities("Київ", controller.signal).then(
      () => null,
      (error: unknown) => error
    );
    await vi.advanceTimersByTimeAsync(600);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    controller.abort();
    finishRead();
    const error = await settled;
    expect(error).toMatchObject({ name: "AbortError" });
    expect(error).not.toBeInstanceOf(NpDirectoryError);
  });
});
