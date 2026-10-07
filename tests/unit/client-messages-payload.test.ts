import { describe, it, expect } from "vitest";
import uk from "../../messages/uk.json";
import { STOREFRONT_EXCLUDED_NAMESPACES } from "@/i18n/client-namespaces";

/**
 * The root layout serializes the catalog into NextIntlClientProvider on every
 * storefront page. Measured 2026-09-21: 28,620 bytes without `admin`. The
 * seven G23 pages are Server Components, so their copy must not join it.
 *
 * These assertions compare against an INDEPENDENTLY COMPUTED expectation —
 * the catalog's own key set — rather than `length > 0`, which would pass on
 * an empty exclusion list.
 */
describe("storefront client message payload", () => {
  const ALL = Object.keys(uk);

  function clientNamespaces(): string[] {
    return ALL.filter((ns) => !STOREFRONT_EXCLUDED_NAMESPACES.includes(ns));
  }

  it("withholds exactly admin and pages", () => {
    expect([...STOREFRONT_EXCLUDED_NAMESPACES].sort()).toEqual(["admin", "pages"]);
  });

  it("does not hand the pages namespace to the client provider", () => {
    expect(clientNamespaces()).not.toContain("pages");
  });

  it("does not hand the admin namespace to the client provider", () => {
    expect(clientNamespaces()).not.toContain("admin");
  });

  it("still hands every other catalog namespace to the client provider", () => {
    const expected = ALL.filter((ns) => ns !== "admin" && ns !== "pages");
    expect(clientNamespaces().sort()).toEqual(expected.sort());
    // Guard the guard: the catalog must actually HAVE the namespaces the
    // storefront renders, so this is not vacuously comparing [] to [].
    expect(expected).toContain("header");
    expect(expected).toContain("footer");
    expect(expected).toContain("products");
  });
});
