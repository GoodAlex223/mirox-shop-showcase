/**
 * Post-login redirect validation.
 *
 * `?callbackUrl=` is attacker-supplied: anyone can mail a victim a link to the
 * real login page carrying any destination they like. Next's app router treats
 * a URL whose origin differs from the current one as external and performs a
 * full browser navigation, so an unvalidated value turns a genuine login into a
 * redirect to an attacker's look-alike page (G17 finding F5).
 *
 * Only same-origin, path-relative destinations are accepted. Everything else
 * falls back to the site root rather than erroring — a bad callback is not the
 * user's problem, and failing the login over it would be worse than ignoring it.
 */
const FALLBACK = "/";

export function safeCallbackUrl(raw: string | null | undefined): string {
  if (!raw) return FALLBACK;

  // Whitespace (including the tab/newline browsers strip from URLs) is a common
  // way to smuggle a scheme past a naive prefix check.
  const value = raw.trim();

  // Must be a rooted path...
  if (!value.startsWith("/")) return FALLBACK;

  // ...but not a protocol-relative URL. `//evil.tld` and the backslash variants
  // browsers normalise to it are absolute destinations wearing a path's clothes.
  if (/^\/[/\\]/.test(value)) return FALLBACK;

  return value;
}
