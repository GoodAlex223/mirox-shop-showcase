/**
 * Honest bundle math (spec §2 #3): the struck-through figure is the sum of
 * genuine comparePrices (falling back to price), shown ONLY when it exceeds
 * the real sum. Checkout recomputes prices from the DB, so this module must
 * never invent a discount the server won't honor.
 */
export interface BundlePricedItem {
  price: string;
  comparePrice: string | null;
}

export function computeBundleTotals(items: BundlePricedItem[]): {
  total: number;
  compareTotal: number;
  showStrike: boolean;
} {
  const total = items.reduce((sum, i) => sum + parseFloat(i.price), 0);
  const compareTotal = items.reduce((sum, i) => sum + parseFloat(i.comparePrice ?? i.price), 0);
  return { total, compareTotal, showStrike: compareTotal > total };
}
