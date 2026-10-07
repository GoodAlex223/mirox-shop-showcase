import { describe, it, expect } from "vitest";
import { OrderStatus } from "@prisma/client";
import { getOrderStatusStyle, ORDER_STATUS_STYLES } from "@/lib/order-status";

describe("order-status", () => {
  // Iterates the real Prisma enum rather than a hardcoded local list, so that
  // adding a status to the schema (e.g. upcoming Ukraine COD work) fails this
  // test instead of silently falling through to ORDER_STATUS_STYLES' default.
  it("defines a style for every OrderStatus value", () => {
    for (const s of Object.values(OrderStatus)) {
      expect(ORDER_STATUS_STYLES[s]).toBeTruthy();
    }
  });

  it("uses the destructive token only for negative terminal states", () => {
    expect(getOrderStatusStyle("CANCELLED")).toContain("destructive");
    expect(getOrderStatusStyle("REFUNDED")).toContain("destructive");
    expect(getOrderStatusStyle("DELIVERED")).not.toContain("destructive");
    expect(getOrderStatusStyle("PENDING")).not.toContain("destructive");
  });

  it("contains no bright color utilities", () => {
    const bright = /-(red|blue|green|yellow|amber|orange|purple|indigo|pink|emerald|teal|gray)-\d/;
    for (const cls of Object.values(ORDER_STATUS_STYLES)) {
      expect(cls).not.toMatch(bright);
    }
  });

  // Label tests removed (PR #37 review round 2): getOrderStatusLabel and the
  // re-exported maps were deleted with src/content/account.ts (no production
  // consumers). Enum→label coverage lives in i18n-catalogs.test.ts's drift
  // net against messages/uk.json.
});
