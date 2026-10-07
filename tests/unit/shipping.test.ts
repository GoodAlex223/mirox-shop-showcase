import { describe, it, expect } from "vitest";
import {
  DELIVERY_METHODS,
  DEFAULT_DELIVERY_METHOD_ID,
  getDeliveryMethod,
  getPickupKind,
  getShippingMethodLabel,
} from "@/lib/shipping";

describe("shipping", () => {
  it("exposes the three Nova Poshta methods with UAH prices", () => {
    expect(DELIVERY_METHODS.map((m) => m.id)).toEqual(["np-office", "np-courier", "np-postomat"]);
    expect(DELIVERY_METHODS.map((m) => m.price)).toEqual([80, 120, 70]);
  });

  it("defaults to np-office", () => {
    expect(DEFAULT_DELIVERY_METHOD_ID).toBe("np-office");
  });

  it("getDeliveryMethod finds by id and returns undefined for unknown", () => {
    expect(getDeliveryMethod("np-courier")?.price).toBe(120);
    expect(getDeliveryMethod("dhl")).toBeUndefined();
  });

  it("getShippingMethodLabel maps NP ids to Ukrainian names", () => {
    expect(getShippingMethodLabel("np-office")).toBe("Нова Пошта — відділення");
    expect(getShippingMethodLabel("np-courier")).toBe("Нова Пошта — кур'єр");
    expect(getShippingMethodLabel("np-postomat")).toBe("Нова Пошта — поштомат");
  });

  it("getShippingMethodLabel maps legacy ids (pre-G2 orders) to their labels", () => {
    expect(getShippingMethodLabel("standard")).toBe("Standard Shipping");
    expect(getShippingMethodLabel("express")).toBe("Express Shipping");
    expect(getShippingMethodLabel("overnight")).toBe("Overnight Shipping");
  });

  it("getShippingMethodLabel falls back to the raw id", () => {
    expect(getShippingMethodLabel("mystery")).toBe("mystery");
  });
});

describe("getPickupKind (G25)", () => {
  it("maps the two pickup methods to their directory kind", () => {
    expect(getPickupKind("np-office")).toBe("branch");
    expect(getPickupKind("np-postomat")).toBe("postomat");
  });

  it("returns null for courier, legacy and unknown ids", () => {
    expect(getPickupKind("np-courier")).toBeNull();
    expect(getPickupKind("standard")).toBeNull();
    expect(getPickupKind("")).toBeNull();
  });
});
