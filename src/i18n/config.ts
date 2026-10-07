/**
 * Locale registry for the cookie-mode i18n setup (TASK-039 spec §1).
 * UA is the legal + SEO default; RU is a user-preference toggle. The cookie
 * name matches next-intl's routing convention so a future URL-routing
 * upgrade reads the same cookie.
 */
export const LOCALES = ["uk", "ru"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "uk";
export const LOCALE_COOKIE = "NEXT_LOCALE";
/** Display labels for the header toggle. */
export const LOCALE_LABELS: Record<Locale, string> = { uk: "UA", ru: "RU" };

export function resolveLocale(raw: string | undefined): Locale {
  return (LOCALES as readonly string[]).includes(raw ?? "") ? (raw as Locale) : DEFAULT_LOCALE;
}
