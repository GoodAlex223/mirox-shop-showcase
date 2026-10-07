import { describe, it, expect, vi, beforeEach } from "vitest";
import { createNextRequest } from "../helpers/api-test-utils";

vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));
vi.mock("@/lib/nova-poshta", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/nova-poshta")>()),
  cachedSearchCities: vi.fn(),
}));

import { GET } from "@/app/api/shipping/np/cities/route";
import { cachedSearchCities, NovaPoshtaError, NovaPoshtaRateLimitError } from "@/lib/nova-poshta";
import { KYIV_CITY_REF } from "../fixtures/nova-poshta";

const search = vi.mocked(cachedSearchCities);
const KYIV = { ref: KYIV_CITY_REF, name: "Київ", area: "Київська" };

function get(q?: string) {
  return GET(
    createNextRequest({
      url: "/api/shipping/np/cities",
      ...(q !== undefined && { searchParams: { q } }),
    })
  );
}

beforeEach(() => {
  search.mockReset();
});

describe("GET /api/shipping/np/cities", () => {
  it("returns 200 with the matching cities", async () => {
    search.mockResolvedValue([KYIV]);
    const res = await get("київ");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ items: [KYIV] });
  });

  it("passes the trimmed query to the search", async () => {
    search.mockResolvedValue([]);
    await get("  київ  ");
    expect(search).toHaveBeenCalledWith("київ");
  });

  it.each([
    ["missing", undefined],
    ["one character", "к"],
    ["blank after trimming", "    "],
    ["over 50 characters", "к".repeat(51)],
  ])("returns 400 VALIDATION_ERROR when q is %s", async (_label, q) => {
    const res = await get(q);
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("VALIDATION_ERROR");
    expect(search).not.toHaveBeenCalled();
  });

  it.each([2, 50])("accepts a q of exactly %i characters", async (length) => {
    search.mockResolvedValue([]);
    const res = await get("к".repeat(length));
    expect(res.status).toBe(200);
    expect(search).toHaveBeenCalledWith("к".repeat(length));
  });

  it("rejects a q of 51 characters", async () => {
    expect((await get("к".repeat(51))).status).toBe(400);
  });

  it("returns 502 NP_UNAVAILABLE when Nova Poshta fails", async () => {
    search.mockRejectedValue(new NovaPoshtaError("NP error: API key expired"));
    const res = await get("київ");
    expect(res.status).toBe(502);
    expect((await res.json()).code).toBe("NP_UNAVAILABLE");
  });

  it("returns 503 NP_BUSY with the retry hint and a Retry-After header when NP throttles", async () => {
    search.mockRejectedValue(new NovaPoshtaRateLimitError("NP rate limit: To many requests", 600));
    const res = await get("київ");
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({
      error: "Nova Poshta is busy",
      code: "NP_BUSY",
      retryAfterMs: 600,
    });
    expect(res.headers.get("Retry-After")).toBe("1");
  });

  it("rounds Retry-After up to whole seconds", async () => {
    search.mockRejectedValue(new NovaPoshtaRateLimitError("NP rate limit: x", 1500));
    expect((await get("київ")).headers.get("Retry-After")).toBe("2");
  });

  it("returns 500 SEARCH_FAILED for an error that is not Nova Poshta's", async () => {
    search.mockRejectedValue(new Error("boom"));
    const res = await get("київ");
    expect(res.status).toBe(500);
    expect((await res.json()).code).toBe("SEARCH_FAILED");
  });
});
