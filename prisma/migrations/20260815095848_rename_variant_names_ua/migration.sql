-- G14 (2026-08-15): rename variant-name data values to Ukrainian.
-- Data-only migration (no schema change). Matched verbatim by the storefront
-- via src/lib/variant-names.ts (VARIANT_NAMES); seed writes the new values.
-- Historical OrderItem.variantInfo snapshots ("Size: M") are deliberately NOT
-- rewritten — they are frozen receipts.
UPDATE "product_variants" SET "name" = 'Розмір' WHERE "name" = 'Size';
UPDATE "product_variants" SET "name" = 'Колір' WHERE "name" = 'Color';
