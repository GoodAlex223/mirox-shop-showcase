/**
 * Brand constants. Deliberately dependency-free: src/lib/seo.ts imports this,
 * and seo.ts is consumed by the OG image route, robots, sitemap and the
 * Google Shopping feed. Never add an import to this file — importing site.ts
 * instead would drag lucide-react into all of them.
 */

export const BRAND_NAME = "Mirox Shop";

/**
 * Long form. TASK-039 G9 copied this value into the i18n catalog as
 * `brand.tagline` (Footer.tsx's copyright line reads it via t() now) — but
 * the CONSTANT itself is deliberately kept here, not deleted, because
 * src/app/opengraph-image.tsx (Satori/ImageResponse — an SEO-layer route)
 * imports it directly and must keep compiling. Same reason BRAND_META_SUFFIX
 * survives below (Task 8 resolved both pre-flight-missed imports the same
 * way: keep the constant, duplicate the value into the catalog).
 */
export const BRAND_TAGLINE = "Сучасний одяг для тих, хто цінує якість і мінімалізм.";

// BRAND_HERO_SUBTITLE removed (TASK-039 G9) — its one and only consumer
// (home.ts's hero.subtitle field) is gone; the same sentence now lives in
// the catalog twice by design (matching this constant's original
// relationship to BRAND_TAGLINE above): home.hero.subtitle (consumed by
// Hero.tsx) and brand.heroSubtitle (reserved — Task 8's SEO layer used the
// longer brand.description/brand.metaSuffix pair below instead, so
// heroSubtitle stays unconsumed pending a future use).

/**
 * Value duplicated byte-identically into the i18n catalog as `brand.metaSuffix`
 * (Task 8) for src/lib/seo.ts's getHomeMetadata, which needs it translated
 * per-locale. The CONSTANT survives here — unlike BRAND_DESCRIPTION below,
 * which was deleted — because src/app/opengraph-image.tsx (the site-wide OG
 * image route) imports it directly. That route is prerendered once at
 * `next build` time (no request in flight), so it cannot call the
 * request-scoped `getTranslations` seo.ts now uses; reading the surviving
 * constant is the only option, same precedent as BRAND_TAGLINE above.
 */
export const BRAND_META_SUFFIX = "Сучасний одяг";

// BRAND_DESCRIPTION removed (TASK-039 Task 8) — its value now lives only in
// the i18n catalog as `brand.description`. Its two consumers (siteConfig's
// `description` field in src/lib/seo.ts, used by getDefaultMetadata,
// getHomeMetadata and getProductMetadata's last-resort fallback) all became
// async and now read `brand.description` via getTranslations directly, so
// nothing imports this constant anymore — same disposal as
// BRAND_HERO_SUBTITLE above, unlike BRAND_META_SUFFIX, which still has a
// surviving importer.

/** Social link data. Icon components stay in the UI layer (SocialLinks.tsx). */
export interface SocialLink {
  platform: "instagram" | "tiktok" | "telegram";
  label: string;
  href: string;
  /**
   * CLIENT-SUPPLIED. Real follower count, or null for no counter.
   * Never fabricate this — TODO.md AC requires counters only when real numbers
   * are supplied, and invented social proof is out of scope per TASK-051.
   */
  followers: number | null;
}

/**
 * CLIENT-SUPPLIED. Placeholder handles until the client confirms real URLs.
 * Relocated from site.ts (G5) so email templates can consume the hrefs
 * without dragging lucide-react into API-route bundles.
 */
export const SOCIALS: SocialLink[] = [
  {
    platform: "instagram",
    label: "Instagram",
    href: "https://instagram.com/mirox_shop",
    followers: null,
  },
  {
    platform: "tiktok",
    label: "TikTok",
    href: "https://tiktok.com/@mirox_shop",
    followers: null,
  },
  { platform: "telegram", label: "Telegram", href: "https://t.me/mirox_shop", followers: null },
];

/**
 * CLIENT-SUPPLIED, PENDING. Manager WhatsApp link (wa.me/…).
 * null hides the link everywhere it's consumed (checkout payment step, order
 * emails) — a zero-filled number would render as a clickable dead link
 * (PR #29 review ruling). Fill with the real number to light both up.
 */
export const WHATSAPP_HREF: string | null = null;

/**
 * Manager handle, as supplied by the store owner. Distinct from SOCIALS' `telegram`, which is the
 * shop CHANNEL (t.me/mirox_shop): the channel broadcasts, the manager answers.
 *
 * Deliberately NOT placed in the WHATSAPP_HREF slot (G23 spec §6): a Telegram
 * URL under a WhatsApp label would be a small untruth on checkout and on the
 * order e-mail. WHATSAPP_HREF stays null until a real number arrives.
 */
export const MANAGER_TELEGRAM_HREF = "https://t.me/mirox_manager";

/** Reviews channel. Shown on /contact only. */
export const REVIEWS_CHANNEL_HREF = "https://t.me/mirox_vidgyk";

/**
 * The developer's site, carrying every contact method. E-mail is
 * deliberately NOT rendered anywhere on the storefront — harvestable, and it
 * already lives on the linked site.
 */
export const DEVELOPER_CREDIT_HREF = "https://goodalex223.github.io";
