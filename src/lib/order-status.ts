/**
 * Single source of truth for OrderStatus presentation styles.
 * Monochrome by policy; the destructive (red) token is reserved for the
 * negative terminal states CANCELLED and REFUNDED.
 * Customer-facing label copy lives in the messages catalog
 * (account.orderStatus/account.paymentStatus). Both customer and admin
 * surfaces source labels from the catalog (admin reuses the account.*
 * keys; G13).
 */
export const ORDER_STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-muted text-muted-foreground",
  CONFIRMED: "bg-muted text-foreground",
  PROCESSING: "bg-secondary text-secondary-foreground",
  SHIPPED: "bg-secondary text-secondary-foreground",
  DELIVERED: "bg-foreground text-background",
  CANCELLED: "bg-destructive/10 text-destructive",
  REFUNDED: "bg-destructive/10 text-destructive",
};

export function getOrderStatusStyle(status: string): string {
  return ORDER_STATUS_STYLES[status] ?? "bg-muted text-muted-foreground";
}

export const PAYMENT_STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-muted text-muted-foreground",
  PAID: "bg-foreground text-background",
  FAILED: "bg-destructive/10 text-destructive",
  REFUNDED: "bg-destructive/10 text-destructive",
  PARTIALLY_REFUNDED: "bg-secondary text-secondary-foreground",
};

export function getPaymentStatusStyle(status: string): string {
  return PAYMENT_STATUS_STYLES[status] ?? "bg-muted text-muted-foreground";
}
