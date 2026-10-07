import type { WarehouseKind } from "@/lib/nova-poshta-shared";

/**
 * Delivery options for the no-prepayment COD checkout (spec
 * 2026-08-06-g2-checkout-restyle-cod-design.md §3). UAH numerics — with
 * Stripe out of the checkout path these are the real order amounts.
 * Interim NP published rates until TASK-049 (live NP integration).
 *
 * DELIBERATE DUPLICATION (TASK-039 i18n G9 Task 5, per the implementation
 * plan): each method's `name` is byte-duplicated into messages/uk.json's
 * `shipping.<id>` catalog keys, which the live checkout selection UI reads
 * instead of this array (so the string translates). This module — the
 * `.name`/`.description` fields, `getShippingMethodLabel()` — stays the
 * source of truth for email templates and any non-request/legacy code (e.g.
 * the confirmation page's historical-order display, which must also resolve
 * pre-G2 Stripe-era ids via LEGACY_METHOD_LABELS below). Renaming a method's
 * `name` here requires updating the matching `shipping.<id>` catalog key too.
 */
export const DELIVERY_METHODS = [
  { id: "np-office", name: "Нова Пошта — відділення", description: "1-3 дні", price: 80 },
  { id: "np-courier", name: "Нова Пошта — кур'єр", description: "1-3 дні, до дверей", price: 120 },
  { id: "np-postomat", name: "Нова Пошта — поштомат", description: "1-3 дні", price: 70 },
] as const;

export type DeliveryMethodId = (typeof DELIVERY_METHODS)[number]["id"];

export const DEFAULT_DELIVERY_METHOD_ID: DeliveryMethodId = "np-office";

export function getDeliveryMethod(id: string) {
  return DELIVERY_METHODS.find((method) => method.id === id);
}

// G25: the methods whose destination is an NP pickup point, and which
// directory kind each one searches. Courier delivers to a street address.
const PICKUP_KIND: Partial<Record<DeliveryMethodId, WarehouseKind>> = {
  "np-office": "branch",
  "np-postomat": "postomat",
};

export function getPickupKind(methodId: string): WarehouseKind | null {
  return PICKUP_KIND[methodId as DeliveryMethodId] ?? null;
}

// Orders created before G2 store the retired Stripe-era method ids.
const LEGACY_METHOD_LABELS: Record<string, string> = {
  standard: "Standard Shipping",
  express: "Express Shipping",
  overnight: "Overnight Shipping",
};

/** Display label for any stored Order.shippingMethod value, old or new. */
export function getShippingMethodLabel(id: string): string {
  return getDeliveryMethod(id)?.name ?? LEGACY_METHOD_LABELS[id] ?? id;
}
