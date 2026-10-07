// GA4 E-commerce Event Types and DataLayer Helper
// Reference: https://developers.google.com/analytics/devguides/collection/ga4/ecommerce

export interface GA4Item {
  item_id: string;
  item_name: string;
  item_category?: string;
  item_variant?: string;
  price: number;
  quantity: number;
  index?: number;
  item_list_id?: string;
  item_list_name?: string;
}

declare global {
  interface Window {
    dataLayer: Record<string, unknown>[];
  }
}

/**
 * Safely push an event to the GTM dataLayer.
 * Clears previous ecommerce data before each push to prevent data leakage.
 */
function pushDataLayer(event: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  try {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ ecommerce: null });
    window.dataLayer.push(event);
  } catch {
    // Silently fail — don't break the app if analytics is blocked
  }
}

// ---- Convenience functions for GA4 e-commerce events ----

export function trackViewItemList(items: GA4Item[], listId?: string, listName?: string): void {
  pushDataLayer({
    event: "view_item_list",
    ecommerce: {
      item_list_id: listId,
      item_list_name: listName,
      items,
    },
  });
}

export function trackSelectItem(item: GA4Item, listId?: string, listName?: string): void {
  pushDataLayer({
    event: "select_item",
    ecommerce: {
      item_list_id: listId,
      item_list_name: listName,
      items: [item],
    },
  });
}

export function trackViewItem(item: GA4Item): void {
  pushDataLayer({
    event: "view_item",
    ecommerce: {
      currency: "UAH",
      value: item.price * item.quantity,
      items: [item],
    },
  });
}

export function trackAddToCart(item: GA4Item): void {
  pushDataLayer({
    event: "add_to_cart",
    ecommerce: {
      currency: "UAH",
      value: item.price * item.quantity,
      items: [item],
    },
  });
}

export function trackViewCart(items: GA4Item[], value: number): void {
  pushDataLayer({
    event: "view_cart",
    ecommerce: {
      currency: "UAH",
      value,
      items,
    },
  });
}

export function trackBeginCheckout(items: GA4Item[], value: number): void {
  pushDataLayer({
    event: "begin_checkout",
    ecommerce: {
      currency: "UAH",
      value,
      items,
    },
  });
}

export function trackAddShippingInfo(items: GA4Item[], value: number, shippingTier: string): void {
  pushDataLayer({
    event: "add_shipping_info",
    ecommerce: {
      currency: "UAH",
      value,
      shipping_tier: shippingTier,
      items,
    },
  });
}

export function trackAddPaymentInfo(items: GA4Item[], value: number, paymentType: string): void {
  pushDataLayer({
    event: "add_payment_info",
    ecommerce: {
      currency: "UAH",
      value,
      payment_type: paymentType,
      items,
    },
  });
}

export function trackPurchase(
  transactionId: string,
  value: number,
  items: GA4Item[],
  shipping?: number,
  tax?: number
): void {
  pushDataLayer({
    event: "purchase",
    ecommerce: {
      transaction_id: transactionId,
      currency: "UAH",
      value,
      shipping,
      tax,
      items,
    },
  });
}

/**
 * Track social share event.
 * Uses GA4 built-in 'share' event type.
 * @see https://developers.google.com/analytics/devguides/collection/ga4/reference/events#share
 */
export function trackShare(method: string, contentType: string, itemId: string): void {
  pushDataLayer({
    event: "share",
    method,
    content_type: contentType,
    item_id: itemId,
  });
}
