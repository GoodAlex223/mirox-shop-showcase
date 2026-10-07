/**
 * Errors shared by the two order-creating checkout routes.
 *
 * `create-order` (guest COD, live) and `confirm-order` (card, dormant since G2)
 * run the same `updateMany` + `stock: { gte }` decrement, so they must fail the
 * same way. G17 F8 fixed the guard in both but left the error typed in only one,
 * which meant the dormant route reported a sold-out line as a generic 500 —
 * caught in PR #43 review. Keeping the class here rather than duplicating it is
 * what stops the two contracts drifting again while the Stripe path sleeps.
 */

/** Thrown inside the order transaction when the gte guard rejects a decrement. */
export class InsufficientStockError extends Error {
  constructor(readonly productName: string) {
    super(`Insufficient stock for ${productName}`);
    this.name = "InsufficientStockError";
  }
}

/** The single response both routes return for it. */
export const INSUFFICIENT_STOCK_RESPONSE = {
  body: { error: "Insufficient stock", code: "INSUFFICIENT_STOCK" },
  status: 409,
} as const;
