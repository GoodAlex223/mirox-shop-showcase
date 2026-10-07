import { describe, it, expect } from "vitest";
import {
  googleShoppingItemSchema,
  validateFeedItem,
  validateFeedItemSafe,
} from "@/lib/validations/google-shopping";
import type { GoogleShoppingItem } from "@/lib/validations/google-shopping";

// ---------------------------------------------------------------------------
// Test data helpers
// ---------------------------------------------------------------------------

function validItem(overrides: Partial<GoogleShoppingItem> = {}): GoogleShoppingItem {
  return {
    id: "prod-123",
    title: "Test Product",
    description: "A great product for testing purposes",
    link: "https://example.com/products/test-product",
    image_link: "https://example.com/images/test.jpg",
    price: "29.99 USD",
    availability: "in stock",
    condition: "new",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Validation schema tests
// ---------------------------------------------------------------------------

describe("Google Shopping Feed Validation", () => {
  describe("googleShoppingItemSchema", () => {
    it("should validate a complete valid item", () => {
      const item = validItem({
        gtin: "0123456789012",
        mpn: "MPN-001",
        brand: "TestBrand",
        product_type: "Electronics",
        sale_price: "24.99 USD",
      });

      const result = googleShoppingItemSchema.safeParse(item);
      expect(result.success).toBe(true);
    });

    it("should validate a minimal valid item (required fields only)", () => {
      const item = validItem();
      const result = googleShoppingItemSchema.safeParse(item);
      expect(result.success).toBe(true);
    });

    it("should reject missing required fields", () => {
      const result = googleShoppingItemSchema.safeParse({ id: "prod-1" });
      expect(result.success).toBe(false);
    });

    it("should reject empty id", () => {
      const result = googleShoppingItemSchema.safeParse(validItem({ id: "" }));
      expect(result.success).toBe(false);
    });

    it("should reject title longer than 150 characters", () => {
      const result = googleShoppingItemSchema.safeParse(validItem({ title: "A".repeat(151) }));
      expect(result.success).toBe(false);
    });

    it("should reject description longer than 5000 characters", () => {
      const result = googleShoppingItemSchema.safeParse(
        validItem({ description: "A".repeat(5001) })
      );
      expect(result.success).toBe(false);
    });

    it("should reject invalid product URL", () => {
      const result = googleShoppingItemSchema.safeParse(validItem({ link: "not-a-url" }));
      expect(result.success).toBe(false);
    });

    it("should reject invalid image URL", () => {
      const result = googleShoppingItemSchema.safeParse(validItem({ image_link: "not-a-url" }));
      expect(result.success).toBe(false);
    });
  });

  describe("price format validation", () => {
    it("should accept valid price format (XX.XX USD)", () => {
      const result = googleShoppingItemSchema.safeParse(validItem({ price: "29.99 USD" }));
      expect(result.success).toBe(true);
    });

    it("should accept zero-dollar price", () => {
      const result = googleShoppingItemSchema.safeParse(validItem({ price: "0.00 USD" }));
      expect(result.success).toBe(true);
    });

    it("should accept large prices", () => {
      const result = googleShoppingItemSchema.safeParse(validItem({ price: "99999.99 USD" }));
      expect(result.success).toBe(true);
    });

    it("should reject price without currency code", () => {
      const result = googleShoppingItemSchema.safeParse(validItem({ price: "29.99" }));
      expect(result.success).toBe(false);
    });

    it("should reject price with wrong decimal places", () => {
      const result = googleShoppingItemSchema.safeParse(validItem({ price: "29.9 USD" }));
      expect(result.success).toBe(false);
    });

    it("should reject price with lowercase currency", () => {
      const result = googleShoppingItemSchema.safeParse(validItem({ price: "29.99 usd" }));
      expect(result.success).toBe(false);
    });

    it("should accept valid sale_price format", () => {
      const result = googleShoppingItemSchema.safeParse(validItem({ sale_price: "19.99 USD" }));
      expect(result.success).toBe(true);
    });

    it("should reject invalid sale_price format", () => {
      const result = googleShoppingItemSchema.safeParse(validItem({ sale_price: "19.99" }));
      expect(result.success).toBe(false);
    });
  });

  describe("availability validation", () => {
    it.each(["in stock", "out of stock", "preorder", "backorder"] as const)(
      "should accept availability value: %s",
      (availability) => {
        const result = googleShoppingItemSchema.safeParse(validItem({ availability }));
        expect(result.success).toBe(true);
      }
    );

    it("should reject invalid availability value", () => {
      const result = googleShoppingItemSchema.safeParse(
        validItem({ availability: "available" as never })
      );
      expect(result.success).toBe(false);
    });
  });

  describe("condition validation", () => {
    it.each(["new", "refurbished", "used"] as const)(
      "should accept condition value: %s",
      (condition) => {
        const result = googleShoppingItemSchema.safeParse(validItem({ condition }));
        expect(result.success).toBe(true);
      }
    );

    it("should reject invalid condition value", () => {
      const result = googleShoppingItemSchema.safeParse(validItem({ condition: "old" as never }));
      expect(result.success).toBe(false);
    });
  });

  describe("GTIN validation", () => {
    it("should accept 8-digit GTIN (GTIN-8)", () => {
      const result = googleShoppingItemSchema.safeParse(validItem({ gtin: "12345678" }));
      expect(result.success).toBe(true);
    });

    it("should accept 12-digit GTIN (UPC)", () => {
      const result = googleShoppingItemSchema.safeParse(validItem({ gtin: "012345678901" }));
      expect(result.success).toBe(true);
    });

    it("should accept 13-digit GTIN (EAN)", () => {
      const result = googleShoppingItemSchema.safeParse(validItem({ gtin: "0123456789012" }));
      expect(result.success).toBe(true);
    });

    it("should accept 14-digit GTIN (GTIN-14)", () => {
      const result = googleShoppingItemSchema.safeParse(validItem({ gtin: "01234567890123" }));
      expect(result.success).toBe(true);
    });

    it("should reject GTIN with wrong number of digits", () => {
      const result = googleShoppingItemSchema.safeParse(validItem({ gtin: "1234567" }));
      expect(result.success).toBe(false);
    });

    it("should reject GTIN with non-digit characters", () => {
      const result = googleShoppingItemSchema.safeParse(validItem({ gtin: "ABC12345678" }));
      expect(result.success).toBe(false);
    });

    it("should accept item without GTIN (optional)", () => {
      const item = validItem();
      delete (item as Record<string, unknown>).gtin;
      const result = googleShoppingItemSchema.safeParse(item);
      expect(result.success).toBe(true);
    });
  });

  describe("optional fields", () => {
    it("should accept item without optional fields", () => {
      const item = validItem();
      const result = googleShoppingItemSchema.safeParse(item);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.gtin).toBeUndefined();
        expect(result.data.mpn).toBeUndefined();
        expect(result.data.brand).toBeUndefined();
        expect(result.data.product_type).toBeUndefined();
        expect(result.data.sale_price).toBeUndefined();
      }
    });

    it("should accept item with all optional fields", () => {
      const item = validItem({
        gtin: "0123456789012",
        mpn: "MPN-001",
        brand: "TestBrand",
        product_type: "Electronics > Computers",
        sale_price: "19.99 USD",
      });
      const result = googleShoppingItemSchema.safeParse(item);
      expect(result.success).toBe(true);
    });
  });

  describe("validateFeedItem", () => {
    it("should return validated item for valid input", () => {
      const item = validItem();
      const result = validateFeedItem(item);
      expect(result.id).toBe("prod-123");
      expect(result.title).toBe("Test Product");
    });

    it("should throw for invalid input", () => {
      expect(() => validateFeedItem({ id: "" })).toThrow();
    });
  });

  describe("validateFeedItemSafe", () => {
    it("should return success for valid input", () => {
      const result = validateFeedItemSafe(validItem());
      expect(result.success).toBe(true);
    });

    it("should return failure with errors for invalid input", () => {
      const result = validateFeedItemSafe({ id: "" });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.length).toBeGreaterThan(0);
      }
    });
  });
});
