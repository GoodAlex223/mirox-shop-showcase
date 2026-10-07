import { describe, expect, it } from "vitest";
import { getPaymentStatusStyle, PAYMENT_STATUS_STYLES } from "@/lib/order-status";
import {
  getSupplierOrderStatusStyle,
  SUPPLIER_ORDER_STATUS_STYLES,
} from "@/lib/supplier-order-status";

const BRIGHT = /(yellow|green|red|orange|blue|purple|indigo)-\d/;

describe("getPaymentStatusStyle", () => {
  it("returns a monochrome style for every PaymentStatus value", () => {
    for (const s of ["PENDING", "PAID", "FAILED", "REFUNDED", "PARTIALLY_REFUNDED"]) {
      expect(PAYMENT_STATUS_STYLES[s], `missing style for ${s}`).toBeTruthy();
      expect(getPaymentStatusStyle(s)).not.toMatch(BRIGHT);
    }
  });
  it("falls back to muted for unknown values", () => {
    expect(getPaymentStatusStyle("NOT_A_STATUS")).toBe("bg-muted text-muted-foreground");
  });
});

describe("getSupplierOrderStatusStyle", () => {
  it("returns a monochrome style for every known lowercase status", () => {
    for (const s of [
      "pending",
      "submitted",
      "confirmed",
      "shipped",
      "delivered",
      "cancelled",
      "failed",
    ]) {
      expect(SUPPLIER_ORDER_STATUS_STYLES[s], `missing style for ${s}`).toBeTruthy();
      expect(getSupplierOrderStatusStyle(s)).not.toMatch(BRIGHT);
    }
  });
  it("falls back to muted for unknown values", () => {
    expect(getSupplierOrderStatusStyle("something-new")).toBe("bg-muted text-muted-foreground");
  });
});
