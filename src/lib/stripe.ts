import Stripe from "stripe";

// Lazy initialization to avoid build-time errors when env vars aren't set
let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error("STRIPE_SECRET_KEY is not set");
    }
    _stripe = new Stripe(key, {
      apiVersion: "2026-01-28.clover",
      typescript: true,
    });
  }
  return _stripe;
}

// Shipping rate IDs (configure in Stripe Dashboard)
export const SHIPPING_METHODS = [
  {
    id: "standard",
    name: "Standard Shipping",
    description: "5-7 business days",
    price: 5.99,
  },
  {
    id: "express",
    name: "Express Shipping",
    description: "2-3 business days",
    price: 12.99,
  },
  {
    id: "overnight",
    name: "Overnight Shipping",
    description: "1 business day",
    price: 24.99,
  },
] as const;

export type ShippingMethodId = (typeof SHIPPING_METHODS)[number]["id"];

export function getShippingMethod(id: string) {
  return SHIPPING_METHODS.find((method) => method.id === id);
}

// Calculate order total
export function calculateOrderTotals(
  subtotal: number,
  shippingMethodId: string,
  taxRate: number = 0
) {
  const shippingMethod = getShippingMethod(shippingMethodId);
  const shippingCost = shippingMethod?.price ?? 0;
  const tax = subtotal * taxRate;
  const total = subtotal + shippingCost + tax;

  return {
    subtotal,
    shippingCost,
    tax,
    total,
  };
}

// Generate unique order number
export function generateOrderNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `ORD-${timestamp}-${random}`;
}
