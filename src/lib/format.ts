/**
 * UAH display formatting per the Ukraine payments decision doc §7.4:
 * uk-UA grouping (non-breaking spaces), comma decimals, "грн" AFTER the
 * amount joined by a non-breaking space. Integers render without decimals
 * («1 290 грн»), fractional amounts with exactly two («1 290,50 грн»).
 * The only sanctioned money formatter — do not hand-roll price strings.
 */
export function formatPrice(value: number | string): string {
  const n = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(n)) return formatPrice(0);
  const digits = Number.isInteger(n) ? 0 : 2;
  const formatted = new Intl.NumberFormat("uk-UA", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(n);
  return `${formatted} грн`;
}
