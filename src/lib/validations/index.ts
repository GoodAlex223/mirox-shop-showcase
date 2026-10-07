import { z } from "zod";
import { VARIANT_NAMES } from "@/lib/variant-names";
import { NP_REF_PATTERN } from "@/lib/nova-poshta-shared";

// Auth validations
export const loginSchema = z.object({
  email: z.string().email("Введіть коректний email"),
  password: z.string().min(8, "Пароль має містити щонайменше 8 символів"),
});

export const registerSchema = z
  .object({
    name: z.string().min(2, "Ім'я має містити щонайменше 2 символи"),
    email: z.string().email("Введіть коректний email"),
    password: z.string().min(8, "Пароль має містити щонайменше 8 символів"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Паролі не збігаються",
    path: ["confirmPassword"],
  });

// Product validations
export const productBaseSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  // G24: optional — a blank slug means "generate it from the name". POST derives
  // it through slugFromInput, PUT through generateSlug (src/lib/slug.ts; PUT keeps
  // a slug sent back as stored). Both reject an empty result with SLUG_EMPTY, so
  // the schema only bounds the length.
  slug: z.string().max(255).optional(),
  description: z.string().optional(),
  shortDesc: z.string().max(500).optional(),
  price: z.number().positive("Price must be positive"),
  comparePrice: z.number().positive().optional().nullable(),
  costPrice: z.number().positive().optional().nullable(),
  sku: z.string().min(1, "SKU is required"),
  stock: z.number().int().min(0, "Stock cannot be negative"),
  barcode: z.string().max(14).optional().nullable(),
  brand: z.string().max(70).optional().nullable(),
  mpn: z.string().max(70).optional().nullable(),
  // G16: colourway-sibling link (TASK-037 model — one Product per colourway).
  styleGroup: z.string().max(100).optional().nullable(),
  // G16: Google Shopping opt-out. Deliberately NO .default(): Zod 4 applies
  // defaults even under .partial(), which would reset the flag to false on
  // every partial PUT. The DB default (false) covers creation.
  excludeFromFeed: z.boolean().optional(),
  categoryId: z.string().min(1, "Category is required"),
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
});

export const productSchema = productBaseSchema.refine(
  (data) => !data.comparePrice || data.comparePrice > data.price,
  {
    message: "Compare price must be greater than regular price",
    path: ["comparePrice"],
  }
);

// Product variant validations (G16). `name` is an enum over the canonical DATA
// values — a hand-typed "Size" is unenterable, not merely discouraged
// (stated-conventions-are-not-controls). Per-variant price/sku deliberately
// not exposed (YAGNI).
export const productVariantSchema = z.object({
  name: z.enum([VARIANT_NAMES.size, VARIANT_NAMES.color], {
    message: `Variant name must be "${VARIANT_NAMES.size}" or "${VARIANT_NAMES.color}"`,
  }),
  value: z.string().trim().min(1, "Value is required").max(50),
  stock: z.number().int().min(0, "Stock cannot be negative"),
});

export const productVariantUpdateSchema = productVariantSchema.partial();

// Category validations
export const categorySchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  slug: z.string().max(255).optional(),
  description: z.string().optional().nullable(),
  image: z.string().url().optional().nullable(),
  parentId: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

// Cart validations
export const addToCartSchema = z.object({
  productId: z.string().min(1, "Product ID is required"),
  variantId: z.string().optional(),
  quantity: z.number().int().positive("Quantity must be at least 1"),
});

export const updateCartItemSchema = z.object({
  quantity: z.number().int().positive("Quantity must be at least 1"),
});

// Checkout validations — G2 slim UA form (spec §7): phone is the COD
// fulfillment channel (required); NP branch number replaces the postal code
// (optional); country stays required — the client always submits "UA".
export const shippingAddressSchema = z.object({
  name: z.string().min(1, "Вкажіть ім'я"),
  company: z.string().optional(),
  line1: z.string().min(1, "Вкажіть відділення або адресу"),
  line2: z.string().optional(),
  city: z.string().min(1, "Вкажіть місто"),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().min(2, "Вкажіть країну"),
  phone: z.string().min(1, "Вкажіть номер телефону"),
  // G25: Nova Poshta refs chosen in the checkout picker. Optional — the manual
  // fallback (NP unreachable) saves an order without them; create-order checks
  // which combinations are valid. NP_REF_PATTERN, never z.uuid() (spec §5.2).
  npCityRef: z.string().regex(NP_REF_PATTERN).optional(),
  npWarehouseRef: z.string().regex(NP_REF_PATTERN).optional(),
});

export const checkoutSchema = z.object({
  email: z.string().email("Введіть коректну email-адресу"),
  shippingAddress: shippingAddressSchema,
  shippingMethod: z.string().min(1, "Оберіть спосіб доставки"),
  customerNotes: z.string().max(500).optional(),
});

// Order validations
export const updateOrderStatusSchema = z.object({
  status: z.enum([
    "PENDING",
    "CONFIRMED",
    "PROCESSING",
    "SHIPPED",
    "DELIVERED",
    "CANCELLED",
    "REFUNDED",
  ]),
  trackingNumber: z.string().optional(),
  trackingUrl: z.string().url().optional(),
  notes: z.string().optional(),
});

// Supplier validations
export const supplierSchema = z.object({
  name: z.string().min(1, "Name is required"),
  code: z.string().min(1, "Code is required"),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  website: z.string().url().optional().nullable(),
  apiEndpoint: z.string().url().optional().nullable(),
  apiKey: z.string().optional().nullable(),
  apiType: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
  notes: z.string().optional().nullable(),
});

// Review validations
export const createReviewSchema = z.object({
  productId: z.string().min(1, "Product ID is required"),
  orderId: z.string().min(1, "Order ID is required"),
  rating: z.number().int().min(1, "Rating must be at least 1").max(5, "Rating must be at most 5"),
  comment: z.string().max(2000, "Comment must be less than 2000 characters").optional().nullable(),
});

export const updateReviewSchema = z.object({
  rating: z
    .number()
    .int()
    .min(1, "Rating must be at least 1")
    .max(5, "Rating must be at most 5")
    .optional(),
  comment: z.string().max(2000, "Comment must be less than 2000 characters").optional().nullable(),
});

export const adminReviewReplySchema = z.object({
  adminReply: z
    .string()
    .min(1, "Reply cannot be empty")
    .max(1000, "Reply must be less than 1000 characters"),
});

export const adminReviewVisibilitySchema = z.object({
  isHidden: z.boolean(),
});

// Newsletter validations
export const subscribeNewsletterSchema = z.object({
  email: z.string().email("Invalid email address"),
});

export const unsubscribeNewsletterSchema = z.object({
  email: z.string().email("Invalid email address"),
  token: z.string().min(1, "Token is required"),
});

export const updateSubscriberStatusSchema = z.object({
  status: z.enum(["ACTIVE", "UNSUBSCRIBED"]),
});

// Feedback validations (G8 TASK-058)
const emptyToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

export const feedbackSchema = z.object({
  name: z.preprocess(emptyToUndefined, z.string().trim().max(100, "Name is too long").optional()),
  email: z.preprocess(
    emptyToUndefined,
    z.string().trim().email("Invalid email address").max(254, "Email is too long").optional()
  ),
  message: z
    .string()
    .trim()
    .min(5, "Message must be at least 5 characters")
    .max(2000, "Message must be at most 2000 characters"),
  /** Honeypot — never rejected here; the route silently drops when filled. */
  website: z.string().optional(),
});

// Guest order access (G18). The pattern is shared between the lookup schema
// (client + server) and src/lib/order-access.ts, which must not be imported
// by client code (it pulls node:crypto).
export const ORDER_NUMBER_PATTERN = /^ORD-[A-Z0-9]+-[A-Z0-9]{4}$/;
/** Shared by the lookup schema and the page-side gate (order-access.ts), so neither is looser. */
export const ORDER_NUMBER_MAX_LENGTH = 40;

export const orderLookupSchema = z.object({
  orderNumber: z
    .string()
    .trim()
    .toUpperCase()
    .max(ORDER_NUMBER_MAX_LENGTH, "Order number is too long")
    .regex(ORDER_NUMBER_PATTERN, "Invalid order number"),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Invalid email address")
    .max(254, "Email is too long"),
});

// Google Shopping feed validations
export {
  googleShoppingItemSchema,
  validateFeedItem,
  validateFeedItemSafe,
} from "./google-shopping";
export type { GoogleShoppingItem } from "./google-shopping";

// Type exports
export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ProductInput = z.infer<typeof productSchema>;
export type CategoryInput = z.infer<typeof categorySchema>;
export type AddToCartInput = z.infer<typeof addToCartSchema>;
export type UpdateCartItemInput = z.infer<typeof updateCartItemSchema>;
export type ShippingAddressInput = z.infer<typeof shippingAddressSchema>;
export type CheckoutInput = z.infer<typeof checkoutSchema>;
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;
export type SupplierInput = z.infer<typeof supplierSchema>;
export type CreateReviewInput = z.infer<typeof createReviewSchema>;
export type UpdateReviewInput = z.infer<typeof updateReviewSchema>;
export type AdminReviewReplyInput = z.infer<typeof adminReviewReplySchema>;
export type AdminReviewVisibilityInput = z.infer<typeof adminReviewVisibilitySchema>;
export type SubscribeNewsletterInput = z.infer<typeof subscribeNewsletterSchema>;
export type UnsubscribeNewsletterInput = z.infer<typeof unsubscribeNewsletterSchema>;
export type UpdateSubscriberStatusInput = z.infer<typeof updateSubscriberStatusSchema>;
export type FeedbackInput = z.infer<typeof feedbackSchema>;
export type OrderLookupInput = z.infer<typeof orderLookupSchema>;
