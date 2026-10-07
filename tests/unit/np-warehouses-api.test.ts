import { describe, it, expect, vi, beforeEach } from "vitest";
import { createNextRequest } from "../helpers/api-test-utils";

vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));
vi.mock("@/lib/nova-poshta", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/nova-poshta")>()),
  cachedSearchWarehouses: vi.fn(),
}));

import { GET } from "@/app/api/shipping/np/warehouses/route";
import {
  cachedSearchWarehouses,
  NovaPoshtaError,
  NovaPoshtaRateLimitError,
} from "@/lib/nova-poshta";
import { KYIV_CITY_REF, API_BRANCHES } from "../fixtures/nova-poshta";

const search = vi.mocked(cachedSearchWarehouses);

function get(searchParams: Record<string, string>) {
  return GET(createNextRequest({ url: "/api/shipping/np/warehouses", searchParams }));
}

beforeEach(() => {
  search.mockReset();
});

describe("GET /api/shipping/np/warehouses", () => {
  it("returns 200 with the items and the truncated flag", async () => {
    search.mockResolvedValue(API_BRANCHES);
    const res = await get({ city: KYIV_CITY_REF, kind: "branch" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(API_BRANCHES);
    expect(search).toHaveBeenCalledWith(KYIV_CITY_REF, "branch", "");
  });

  it("passes the trimmed query and the postomat kind through", async () => {
    search.mockResolvedValue({ items: [], truncated: false });
    await get({ city: KYIV_CITY_REF, kind: "postomat", q: "  1001 " });
    expect(search).toHaveBeenCalledWith(KYIV_CITY_REF, "postomat", "1001");
  });

  it.each([
    ["a missing city", { kind: "branch" }],
    ["a malformed city", { city: "bad", kind: "branch" }],
    ["a missing kind", { city: KYIV_CITY_REF }],
    ["an unknown kind", { city: KYIV_CITY_REF, kind: "locker" }],
    ["a query over 50 characters", { city: KYIV_CITY_REF, kind: "branch", q: "1".repeat(51) }],
  ])("returns 400 VALIDATION_ERROR for %s", async (_label, params) => {
    const res = await get(params as Record<string, string>);
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("VALIDATION_ERROR");
    expect(search).not.toHaveBeenCalled();
  });

  it("accepts a q of exactly 50 characters and rejects 51", async () => {
    search.mockResolvedValue({ items: [], truncated: false });
    const ok = await get({ city: KYIV_CITY_REF, kind: "branch", q: "1".repeat(50) });
    expect(ok.status).toBe(200);
    expect(search).toHaveBeenCalledWith(KYIV_CITY_REF, "branch", "1".repeat(50));
    const tooLong = await get({ city: KYIV_CITY_REF, kind: "branch", q: "1".repeat(51) });
    expect(tooLong.status).toBe(400);
  });

  it("returns 502 NP_UNAVAILABLE when Nova Poshta fails", async () => {
    search.mockRejectedValue(new NovaPoshtaError("HTTP 503"));
    const res = await get({ city: KYIV_CITY_REF, kind: "branch" });
    expect(res.status).toBe(502);
    expect((await res.json()).code).toBe("NP_UNAVAILABLE");
  });

  it("returns 503 NP_BUSY with the retry hint and a Retry-After header when NP throttles", async () => {
    search.mockRejectedValue(new NovaPoshtaRateLimitError("NP rate limit: To many requests", 500));
    const res = await get({ city: KYIV_CITY_REF, kind: "branch" });
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({
      error: "Nova Poshta is busy",
      code: "NP_BUSY",
      retryAfterMs: 500,
    });
    expect(res.headers.get("Retry-After")).toBe("1");
  });

  it("rounds Retry-After up to whole seconds", async () => {
    search.mockRejectedValue(new NovaPoshtaRateLimitError("NP rate limit: x", 1500));
    const res = await get({ city: KYIV_CITY_REF, kind: "branch" });
    expect(res.headers.get("Retry-After")).toBe("2");
    expect((await res.json()).retryAfterMs).toBe(1500);
  });

  it("returns 500 SEARCH_FAILED for an error that is not Nova Poshta's", async () => {
    search.mockRejectedValue(new Error("boom"));
    const res = await get({ city: KYIV_CITY_REF, kind: "branch" });
    expect(res.status).toBe(500);
    expect((await res.json()).code).toBe("SEARCH_FAILED");
  });
});
