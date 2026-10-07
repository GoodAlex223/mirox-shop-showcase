import { describe, expect, it } from "vitest";
import { npCitiesQuerySchema, npWarehousesQuerySchema } from "@/lib/validations/nova-poshta";

const REF = "8d5a980d-391c-11dd-90d9-001a92567626";

describe("npCitiesQuerySchema", () => {
  it("rejects one character", () => {
    expect(npCitiesQuerySchema.safeParse({ q: "к" }).success).toBe(false);
  });

  it("accepts the 2 and 50 character boundaries", () => {
    expect(npCitiesQuerySchema.safeParse({ q: "ки" }).success).toBe(true);
    expect(npCitiesQuerySchema.safeParse({ q: "a".repeat(50) }).success).toBe(true);
  });

  it("rejects 51 characters", () => {
    expect(npCitiesQuerySchema.safeParse({ q: "a".repeat(51) }).success).toBe(false);
  });

  it("rejects a query that is blank after trimming", () => {
    expect(npCitiesQuerySchema.safeParse({ q: "   " }).success).toBe(false);
  });

  it("trims the accepted value", () => {
    expect(npCitiesQuerySchema.parse({ q: "  київ " }).q).toBe("київ");
  });
});

describe("npWarehousesQuerySchema", () => {
  it("accepts a valid ref and kind with an empty q", () => {
    expect(npWarehousesQuerySchema.safeParse({ city: REF, kind: "branch", q: "" }).success).toBe(
      true
    );
  });

  it("rejects a malformed city ref", () => {
    expect(
      npWarehousesQuerySchema.safeParse({ city: "not-a-ref", kind: "branch", q: "" }).success
    ).toBe(false);
  });

  it("rejects an unknown kind", () => {
    expect(npWarehousesQuerySchema.safeParse({ city: REF, kind: "locker", q: "" }).success).toBe(
      false
    );
  });

  it("rejects a 51 character q and accepts 50", () => {
    expect(
      npWarehousesQuerySchema.safeParse({ city: REF, kind: "postomat", q: "a".repeat(50) }).success
    ).toBe(true);
    expect(
      npWarehousesQuerySchema.safeParse({ city: REF, kind: "postomat", q: "a".repeat(51) }).success
    ).toBe(false);
  });
});
