/**
 * Namespaces deliberately withheld from the storefront's client payload.
 *
 * `admin` (G13): admin chrome must never ship to the public bundle.
 * `pages` (G23): the seven info/legal pages are Server Components, so their
 * long-form copy has no client consumer — leaving it in would add roughly
 * 100 KB of Cyrillic prose to the RSC payload of EVERY storefront page for
 * text almost no visitor opens. Guarded by
 * tests/unit/client-messages-payload.test.ts.
 *
 * Adding a namespace here means: no client component may call
 * useTranslations() on it. Server Components read the full catalog via
 * getTranslations() regardless of this list.
 */
export const STOREFRONT_EXCLUDED_NAMESPACES: readonly string[] = ["admin", "pages"];
