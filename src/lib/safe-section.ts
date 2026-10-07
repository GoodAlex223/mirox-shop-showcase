/**
 * Fail-soft wrapper for non-critical server-component section queries: a
 * failed query degrades to its fallback (section renders empty/hidden)
 * instead of rejecting the whole page render. Extracted from the homepage
 * (which learned this the hard way — see the prod incident notes there) so
 * the PDP's sibling/companion/review queries share the exact behavior.
 */
export async function safeSection<T>(query: Promise<T>, fallback: T, label: string): Promise<T> {
  try {
    return await query;
  } catch (error) {
    console.error(`[safe-section] "${label}" query failed; rendering without it:`, error);
    return fallback;
  }
}
