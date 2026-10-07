import { z } from "zod";

// Google Shopping feed item validation schema
// Reference: https://support.google.com/merchants/answer/7052112
export const googleShoppingItemSchema = z.object({
  id: z.string().min(1, "Product ID is required").max(50),
  title: z.string().min(1, "Title is required").max(150, "Title must be 150 characters or less"),
  description: z
    .string()
    .min(1, "Description is required")
    .max(5000, "Description must be 5000 characters or less"),
  link: z.string().url("Invalid product URL"),
  image_link: z.string().url("Invalid image URL"),
  price: z
    .string()
    .regex(/^\d+\.\d{2} [A-Z]{3}$/, 'Price must be formatted as "XX.XX CUR" (ISO 4217)'),
  sale_price: z
    .string()
    .regex(/^\d+\.\d{2} [A-Z]{3}$/, 'Sale price must be formatted as "XX.XX CUR" (ISO 4217)')
    .optional(),
  availability: z.enum(["in stock", "out of stock", "preorder", "backorder"]),
  condition: z.enum(["new", "refurbished", "used"]),
  gtin: z
    .string()
    .regex(/^\d{8}$|^\d{12,14}$/, "GTIN must be 8, 12, 13, or 14 digits")
    .optional(),
  mpn: z.string().max(70).optional(),
  brand: z.string().max(70).optional(),
  product_type: z.string().max(750).optional(),
});

export type GoogleShoppingItem = z.infer<typeof googleShoppingItemSchema>;

/**
 * Validate a single feed product item.
 * Returns the validated item or throws with details.
 */
export function validateFeedItem(item: unknown): GoogleShoppingItem {
  return googleShoppingItemSchema.parse(item);
}

/**
 * Validate a feed item without throwing.
 * Returns { success: true, data } or { success: false, errors }.
 */
export function validateFeedItemSafe(item: unknown) {
  return googleShoppingItemSchema.safeParse(item);
}
