import { getRequestConfig } from "next-intl/server";
import type { Messages } from "next-intl";
import { cookies } from "next/headers";
import { LOCALE_COOKIE, resolveLocale } from "./config";
import { deepMerge } from "./merge";
import uk from "../../messages/uk.json";
import ru from "../../messages/ru.json";

export default getRequestConfig(async () => {
  // Next 14: cookies() is synchronous (await-style is Next 15 — G3 lesson class).
  const store = cookies();
  const locale = resolveLocale(store.get(LOCALE_COOKIE)?.value);

  // `pages.*.sections` is an array of objects, which the type layer deliberately
  // presents as an opaque leaf (see global.d.ts — next-intl's key inference
  // cannot recurse through it). The runtime value is the real array, read back
  // by StaticPage via `t.raw()`; this cast is the single point where the two
  // views of the catalog meet.
  const messages = (locale === "ru" ? deepMerge(uk, ru) : uk) as unknown as Messages;

  return {
    locale,
    messages,
    timeZone: "Europe/Kyiv",
  };
});
