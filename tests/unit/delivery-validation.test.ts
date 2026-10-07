import { describe, it, expect } from "vitest";
import { pickerModeErrors } from "@/components/checkout/delivery-validation";

const KYIV = "8d5a980d-391c-11dd-90d9-001a92567626";
const BRANCH_1 = "1ec09d88-e1c2-11e3-8c4a-0050568002cf";

function values(shippingMethod: string, address: Record<string, unknown>) {
  return {
    shippingMethod,
    shippingAddress: {
      name: "Тест",
      phone: "+380501234567",
      country: "UA",
      city: "",
      line1: "",
      ...address,
    },
  } as Parameters<typeof pickerModeErrors>[0];
}

describe("pickerModeErrors", () => {
  it("passes a chosen city and branch", () => {
    expect(
      pickerModeErrors(
        values("np-office", {
          city: "Київ",
          npCityRef: KYIV,
          line1: "Відділення №1",
          npWarehouseRef: BRANCH_1,
        })
      )
    ).toEqual([]);
  });

  it("typed text without a ref is still an error", () => {
    expect(pickerModeErrors(values("np-office", { city: "Київ", line1: "Відділення №1" }))).toEqual(
      [
        { field: "shippingAddress.city", key: "city" },
        { field: "shippingAddress.line1", key: "branch" },
      ]
    );
  });

  it("asks for a postomat on the postomat method", () => {
    expect(pickerModeErrors(values("np-postomat", { npCityRef: KYIV }))).toEqual([
      { field: "shippingAddress.line1", key: "postomat" },
    ]);
  });

  it("asks courier for a city ref and a non-blank street", () => {
    expect(pickerModeErrors(values("np-courier", { line1: "   " }))).toEqual([
      { field: "shippingAddress.city", key: "city" },
      { field: "shippingAddress.line1", key: "street" },
    ]);
    expect(
      pickerModeErrors(values("np-courier", { npCityRef: KYIV, line1: "вул. Хрещатик, 1" }))
    ).toEqual([]);
  });
});
