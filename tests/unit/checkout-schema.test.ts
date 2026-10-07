import { describe, it, expect } from "vitest";
import { checkoutSchema } from "@/lib/validations";

const validInput = {
  email: "test@example.com",
  shippingAddress: {
    name: "Тест Тестовий",
    line1: "Відділення №12",
    city: "Київ",
    country: "UA",
    phone: "+380501234567",
  },
  shippingMethod: "np-office",
};

describe("checkoutSchema (G2 slim UA form)", () => {
  it("accepts the slim form payload without postalCode/company/line2/state", () => {
    const result = checkoutSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it("rejects a missing phone (required for COD fulfillment)", () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- destructure-omit idiom
    const { phone: _phone, ...addressNoPhone } = validInput.shippingAddress;
    const result = checkoutSchema.safeParse({
      ...validInput,
      shippingAddress: addressNoPhone,
    });
    expect(result.success).toBe(false);
  });

  it("rejects an empty phone with the Ukrainian message", () => {
    const result = checkoutSchema.safeParse({
      ...validInput,
      shippingAddress: { ...validInput.shippingAddress, phone: "" },
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("Вкажіть номер телефону");
    }
  });

  it("still accepts an explicit postalCode (legacy/dormant-path compatibility)", () => {
    const result = checkoutSchema.safeParse({
      ...validInput,
      shippingAddress: { ...validInput.shippingAddress, postalCode: "01001" },
    });
    expect(result.success).toBe(true);
  });

  it("keeps country required", () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- destructure-omit idiom
    const { country: _c, ...addressNoCountry } = validInput.shippingAddress;
    const result = checkoutSchema.safeParse({
      ...validInput,
      shippingAddress: addressNoCountry,
    });
    expect(result.success).toBe(false);
  });
});

describe("checkoutSchema — Nova Poshta refs (G25)", () => {
  const KYIV = "8d5a980d-391c-11dd-90d9-001a92567626";
  const BRANCH_1 = "1ec09d88-e1c2-11e3-8c4a-0050568002cf";

  it("accepts an address without refs (the manual fallback)", () => {
    expect(checkoutSchema.safeParse(validInput).success).toBe(true);
  });

  it("accepts real NP refs", () => {
    const result = checkoutSchema.safeParse({
      ...validInput,
      shippingAddress: { ...validInput.shippingAddress, npCityRef: KYIV, npWarehouseRef: BRANCH_1 },
    });
    expect(result.success).toBe(true);
  });

  it.each(["", "not-a-ref", "8d5a980d391c11dd90d9001a92567626"])(
    "rejects the malformed ref %j",
    (ref) => {
      const result = checkoutSchema.safeParse({
        ...validInput,
        shippingAddress: { ...validInput.shippingAddress, npCityRef: ref },
      });
      expect(result.success).toBe(false);
    }
  );
});
