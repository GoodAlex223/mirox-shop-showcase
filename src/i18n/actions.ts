"use server";

import { cookies } from "next/headers";
import { LOCALE_COOKIE, resolveLocale, type Locale } from "./config";

/**
 * Persist the visitor's locale choice (spec §1). Setting a cookie from a
 * server action invalidates the router cache, so the tree re-renders in the
 * new locale without extra refresh plumbing.
 */
export async function setLocale(locale: Locale): Promise<void> {
  const safe = resolveLocale(locale); // never trust the wire value
  cookies().set(LOCALE_COOKIE, safe, {
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
    sameSite: "lax",
  });
}
