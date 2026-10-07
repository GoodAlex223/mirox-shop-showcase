import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import uk from "../../messages/uk.json";

// G24: the four admin catalog write routes answer every error with a machine
// `code`, and the two forms show the catalog's UA copy for it, falling back to a
// generic save error when the code has no entry. A new code without copy would
// degrade silently to that generic sentence — so this reads the codes the
// routes actually emit and requires an entry for each.

const ROUTES = {
  productForm: ["src/app/api/admin/products/route.ts", "src/app/api/admin/products/[id]/route.ts"],
  categories: [
    "src/app/api/admin/categories/route.ts",
    "src/app/api/admin/categories/[id]/route.ts",
  ],
} as const;

// Hand-listed from the routes as of G24 — a lower bound that proves the scan
// below is not vacuous. A route may emit more; it may not emit fewer unnoticed.
const KNOWN: Record<keyof typeof ROUTES, string[]> = {
  productForm: [
    "VALIDATION_ERROR",
    "SLUG_EMPTY",
    "SLUG_TAKEN",
    "SKU_TAKEN",
    "CATEGORY_NOT_FOUND",
    "PRODUCT_NOT_FOUND",
    "CREATE_FAILED",
    "UPDATE_FAILED",
  ],
  categories: [
    "VALIDATION_ERROR",
    "SLUG_EMPTY",
    "SLUG_TAKEN",
    "PARENT_NOT_FOUND",
    "SELF_PARENT",
    "CIRCULAR_PARENT",
    "CATEGORY_NOT_FOUND",
    "CREATE_FAILED",
    "UPDATE_FAILED",
  ],
};

/** Every code passed as apiError's third argument in a route file. */
function emittedCodes(file: string): string[] {
  const source = readFileSync(file, "utf8");
  return [...source.matchAll(/apiError\([^;]*?,\s*\d{3},\s*"([A-Z_]+)"\s*\)/g)].map((m) => m[1]);
}

const catalog = uk.admin as unknown as Record<string, { byCode?: Record<string, string> }>;

describe.each(Object.keys(ROUTES) as (keyof typeof ROUTES)[])("admin.%s.byCode", (namespace) => {
  const found = [...new Set(ROUTES[namespace].flatMap(emittedCodes))].sort();
  const byCode = catalog[namespace].byCode ?? {};

  it("the scan finds every code these routes are known to emit", () => {
    expect(found).toEqual(expect.arrayContaining(KNOWN[namespace]));
  });

  it("has UA copy for every code the routes emit", () => {
    expect(found.filter((code) => !(code in byCode))).toEqual([]);
  });
});
