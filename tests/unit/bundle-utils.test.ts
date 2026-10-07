import { describe, it, expect } from "vitest";
import { computeBundleTotals } from "@/lib/bundle-utils";

describe("computeBundleTotals", () => {
  it("no comparePrices → equal totals, no strike", () => {
    const r = computeBundleTotals([
      { price: "1290", comparePrice: null },
      { price: "590", comparePrice: null },
    ]);
    expect(r).toEqual({ total: 1880, compareTotal: 1880, showStrike: false });
  });

  it("one genuine discount → strike with comparePrice folded in", () => {
    const r = computeBundleTotals([
      { price: "1290", comparePrice: null },
      { price: "590", comparePrice: "690" },
      { price: "490", comparePrice: null },
    ]);
    expect(r).toEqual({ total: 2370, compareTotal: 2470, showStrike: true });
  });

  it("bad data (comparePrice below price) never produces a strike", () => {
    const r = computeBundleTotals([{ price: "1290", comparePrice: "990" }]);
    expect(r.showStrike).toBe(false);
  });

  it("empty input → zeros, no strike", () => {
    expect(computeBundleTotals([])).toEqual({ total: 0, compareTotal: 0, showStrike: false });
  });
});
