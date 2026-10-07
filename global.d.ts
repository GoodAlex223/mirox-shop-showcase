import type uk from "./messages/uk.json";
import type { Locale } from "./src/i18n/config";

/**
 * next-intl derives every namespace and message key from `AppConfig.Messages`
 * by walking it with use-intl's `NestedKeyOf`, which recurses into ANY object
 * — arrays included. `pages.*.sections` (G23) is an array of
 * `{ heading, body[], list? }` objects, and recursing through it (array
 * indices, `length`, every `Array.prototype` method, then the string arrays
 * inside each element) blew the key union past what the checker resolves: the
 * union degraded and `getTranslations("pages.terms.meta")` stopped matching
 * any overload, taking the rest of the catalog's key safety with it.
 *
 * So the section arrays are presented to the type layer as opaque leaves. They
 * are never read through a typed key anyway — `StaticPage` pulls them with
 * `t.raw("sections")` and casts to `PageSection[]`. The runtime catalog is
 * unchanged; `src/i18n/request.ts` holds the one cast that reconciles the two
 * views.
 */
type OpaqueSections<T> = {
  [K in keyof T]: K extends "sections" ? string : OpaqueSections<T[K]>;
};

declare module "next-intl" {
  interface AppConfig {
    Locale: Locale;
    // Scoped to `pages` on purpose: `sections` only ever exists there, and the
    // rest of the catalog keeps its plain `typeof uk` type so the mapped type
    // never walks `admin.*`, `account.*` or anything else.
    Messages: Omit<typeof uk, "pages"> & { pages: OpaqueSections<(typeof uk)["pages"]> };
  }
}
