import { describe, it, expect } from "vitest";
import robots from "@/app/robots";

describe("robots.txt", () => {
  it("keeps the /track form crawlable but hides the per-order status pages", () => {
    const { rules } = robots();
    const rule = Array.isArray(rules) ? rules[0] : rules;
    const disallow = Array.isArray(rule.disallow) ? rule.disallow : [rule.disallow];
    expect(disallow).toContain("/track/");
    expect(disallow).not.toContain("/track");
    expect(disallow).toContain("/checkout/");
  });
});
