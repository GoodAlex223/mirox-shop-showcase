/**
 * Nova Poshta shapes shared by the server client (src/lib/nova-poshta.ts), the
 * order schema (src/lib/validations — bundled into the checkout page) and the
 * checkout components. Deliberately import-free, like src/lib/slug.ts: a client
 * module must never pull in the server client and its `next/cache` import.
 */

/**
 * NP refs are 8-4-4-4-12 hex, but not guaranteed to carry RFC-4122 version and
 * variant bits — so never z.uuid(), which enforces them in Zod 4 (spec §5.2).
 */
export const NP_REF_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The cap on the `q` search text, shared by both NP routes' schemas and the picker's input. */
export const NP_QUERY_MAX_LENGTH = 50;

export const WAREHOUSE_KINDS = ["branch", "postomat"] as const;
export type WarehouseKind = (typeof WAREHOUSE_KINDS)[number];

export interface NpCity {
  ref: string;
  name: string;
  area: string;
}

export interface NpWarehouse {
  ref: string;
  number: string;
  name: string;
}

export interface NpWarehouseResult {
  items: NpWarehouse[];
  /** More points matched than are shown — the picker asks for a narrower search. */
  truncated: boolean;
}

/**
 * The stored `shippingAddress.state`: «Київська» → «Київська обл.». Order DATA
 * the manager reads, not UI copy — it is Ukrainian in both locales, like the
 * variant names in src/lib/variant-names.ts.
 */
export function formatNpArea(area: string): string {
  return area ? `${area} обл.` : "";
}
