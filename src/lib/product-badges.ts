/** Window inside which a product earns the "new" badge (spec §5). */
export const NEW_BADGE_WINDOW_DAYS = 30;

/**
 * True iff the product was created strictly within the last
 * NEW_BADGE_WINDOW_DAYS. Accepts serialized (string) dates because catalog
 * cards receive JSON API responses. Invalid dates are simply not "new".
 */
export function isNewProduct(createdAt: string | Date, now: Date = new Date()): boolean {
  const created = typeof createdAt === "string" ? new Date(createdAt) : createdAt;
  const age = now.getTime() - created.getTime();
  if (Number.isNaN(age)) return false;
  return age >= 0 && age < NEW_BADGE_WINDOW_DAYS * 24 * 60 * 60 * 1000;
}

/** Stable badge descriptor — lib-label pattern (TASK-039 Task 6): this module
 *  never returns display strings, only a KEY (+ any numeric argument a
 *  caller's ICU template needs). Components translate via
 *  `useTranslations("products")` and own the per-key CSS className. */
export type ProductBadge =
  | { key: "sale"; percent: number }
  | { key: "new" }
  | { key: "outOfStock" };

interface BadgeInput {
  /** Already-parsed numeric price (caller owns string→number conversion). */
  price: number;
  comparePrice: number | null;
  createdAt?: string | Date;
  stock: number;
}

/**
 * Single badge max — precedence is discount > new > out-of-stock (spec §4).
 * Moved out of ProductCard (TASK-036) into this pure lib module so the
 * precedence rule has one home and is unit-testable without React/next-intl.
 */
export function getProductBadge({
  price,
  comparePrice,
  createdAt,
  stock,
}: BadgeInput): ProductBadge | null {
  const discount =
    comparePrice && comparePrice > price
      ? Math.round(((comparePrice - price) / comparePrice) * 100)
      : null;
  if (discount) return { key: "sale", percent: discount };
  if (createdAt && isNewProduct(createdAt)) return { key: "new" };
  if (stock <= 0) return { key: "outOfStock" };
  return null;
}
