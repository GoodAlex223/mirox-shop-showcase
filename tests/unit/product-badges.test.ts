import { describe, it, expect } from "vitest";
import { isNewProduct, getProductBadge, NEW_BADGE_WINDOW_DAYS } from "@/lib/product-badges";

const DAY_MS = 24 * 60 * 60 * 1000;
// Must track the real clock: getProductBadge() calls isNewProduct(createdAt)
// without a `now`, so it reads the system clock. A frozen date here rots —
// the "recent" fixture aged past the 30-day window and failed on 2026-08-26 (G16).
const now = new Date();
const recent = new Date(now.getTime() - 5 * DAY_MS).toISOString();
const old = new Date(now.getTime() - 60 * DAY_MS).toISOString();

describe("isNewProduct", () => {
  it("is true for a product created 29 days ago", () => {
    expect(isNewProduct(new Date(now.getTime() - 29 * DAY_MS), now)).toBe(true);
  });

  it("is false for a product created 31 days ago", () => {
    expect(isNewProduct(new Date(now.getTime() - 31 * DAY_MS), now)).toBe(false);
  });

  it("is false at exactly the 30-day boundary", () => {
    expect(isNewProduct(new Date(now.getTime() - NEW_BADGE_WINDOW_DAYS * DAY_MS), now)).toBe(false);
  });

  it("accepts ISO-string dates (serialized API responses)", () => {
    expect(isNewProduct(new Date(now.getTime() - 2 * DAY_MS).toISOString(), now)).toBe(true);
  });

  it("is false for an invalid date string", () => {
    expect(isNewProduct("not-a-date", now)).toBe(false);
  });
});

describe("getProductBadge (TASK-039 Task 6: lib-label pattern — returns a KEY, never a string)", () => {
  it("returns the sale key with the rounded discount percent when comparePrice exceeds price", () => {
    expect(getProductBadge({ price: 80, comparePrice: 100, createdAt: recent, stock: 5 })).toEqual({
      key: "sale",
      percent: 20,
    });
  });

  it("returns the new key for a product created within the window, no discount", () => {
    expect(
      getProductBadge({ price: 100, comparePrice: null, createdAt: recent, stock: 5 })
    ).toEqual({ key: "new" });
  });

  it("returns the outOfStock key when stock is zero, no discount, not new", () => {
    expect(getProductBadge({ price: 100, comparePrice: null, createdAt: old, stock: 0 })).toEqual({
      key: "outOfStock",
    });
  });

  it("returns null when no badge condition applies", () => {
    expect(
      getProductBadge({ price: 100, comparePrice: null, createdAt: old, stock: 5 })
    ).toBeNull();
  });

  it("returns null when comparePrice does not exceed price (no phantom discount)", () => {
    expect(getProductBadge({ price: 100, comparePrice: 100, createdAt: old, stock: 5 })).toBeNull();
  });

  it("precedence: sale wins over new even when both conditions hold", () => {
    expect(
      getProductBadge({ price: 80, comparePrice: 100, createdAt: recent, stock: 5 })
    ).toMatchObject({ key: "sale" });
  });

  it("precedence: sale wins over outOfStock even when both conditions hold", () => {
    expect(
      getProductBadge({ price: 80, comparePrice: 100, createdAt: old, stock: 0 })
    ).toMatchObject({ key: "sale" });
  });

  it("precedence: new wins over outOfStock even when both conditions hold", () => {
    expect(
      getProductBadge({ price: 100, comparePrice: null, createdAt: recent, stock: 0 })
    ).toEqual({ key: "new" });
  });

  it("treats a missing createdAt as never-new (falls through to outOfStock/null)", () => {
    expect(getProductBadge({ price: 100, comparePrice: null, stock: 0 })).toEqual({
      key: "outOfStock",
    });
    expect(getProductBadge({ price: 100, comparePrice: null, stock: 5 })).toBeNull();
  });
});
