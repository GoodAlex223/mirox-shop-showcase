/**
 * Canonical ProductVariant.name data values (G14 rename, 2026-08-15).
 *
 * These are DB data values, not display copy: they live in every
 * ProductVariant row (seeded from prisma/seed-data/products.ts, renamed in
 * prod by the 2026-08-15 data migration) and are matched verbatim by the
 * storefront's variant lookups and the catalog's size/color filters.
 * Changing a value here requires a matching data migration — otherwise every
 * lookup silently returns nothing (empty size pickers, dead filters).
 *
 * prisma/seed-data/products.ts imports this module by relative path (tsx),
 * so seed data and call sites cannot drift apart.
 */
export const VARIANT_NAMES = {
  size: "Розмір",
  color: "Колір",
} as const;
