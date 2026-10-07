import { Truck, CreditCard, ShieldCheck, Headphones, type LucideIcon } from "lucide-react";
import { BRAND_NAME, SOCIALS } from "./brand";

/**
 * Site-wide content, consumed by the homepage and the Footer.
 *
 * CLIENT-SUPPLIED VALUES — the fields marked below come from the store owner
 * and cannot be invented by us. An unset value renders nothing rather than a
 * placeholder.
 */

export type { SocialLink } from "./brand";

export interface ClientClaims {
  /** CLIENT-SUPPLIED. null hides the claim. */
  olxSales: string | null;
  instagramOrders: string | null;
  customerRating: string | null;
}

// title/description moved to the i18n catalog (TASK-039 G9) — see
// `home.benefits.*` / `footer.benefits.*` in messages/uk.json, addressed by
// index. This type keeps only the field that never had a translatable value.
export interface BenefitItem {
  icon: LucideIcon;
}

// text/linkLabel moved to the i18n catalog (TASK-039 G9) — see
// `site.announcement.text` / `site.announcement.linkLabel` in
// messages/uk.json. AnnouncementBar reads copy via `t()` and gating (whether
// to render at all, and which layout) via this config shape.
export interface SiteAnnouncement {
  /** Dismissal-key suffix — bump to resurface for users who dismissed a prior announcement. */
  id: string;
  /** Optional link target; wraps the announcement text in a Link when set. */
  href: string | null;
  /** Scrolling marquee vs the static centered bar. */
  marquee: boolean;
}

export const site = {
  name: BRAND_NAME,
  // tagline field removed (TASK-039 G9) — consumers read t("brand.tagline").
  // site.name stays BRAND_NAME: the brand's own identifier isn't a
  // translatable string.

  // header block removed (TASK-039 G9) — every field (incl. search.* and the
  // nav labels formerly in Header.tsx's own `navigation` array) now lives
  // under the `header` namespace in messages/uk.json; Header.tsx reads it via
  // useTranslations("header").

  /**
   * RETRACTED, not merely unconfirmed — was "Free delivery on orders over
   * 1000 UAH", read off the AI-generated concept mockup.
   * Set to null because no
   * free-shipping threshold exists anywhere in the order path, at any
   * subtotal or currency: calculateOrderTotals() (src/lib/stripe.ts) and the
   * checkout confirm-order route both always charge
   * `shippingMethod?.price ?? 0`, never 0 for a real method. That made this a
   * false claim today, not an unverified one, so "pending client
   * confirmation" was the wrong framing regardless of what the client says.
   *
   * TODO.md's TASK-035 AC requires this banner's *slot* to exist, not any
   * specific promised text — AnnouncementBar already renders nothing when
   * this is null (see its test), which satisfies that AC. Only restore real
   * copy once a threshold is both implemented in code and confirmed with the
   * store owner.
   *
   * The launch announcement below is NOT a client promo claim — it announces
   * our own feedback form (G8 TASK-059), so it doesn't conflict with the
   * retraction rule above. Promo copy still needs client confirmation.
   */
  announcement: {
    id: "launch-2026-08",
    href: "/feedback",
    marquee: true,
  } as SiteAnnouncement | null,

  // announcementDismiss field removed (TASK-039 G9) — moved to the catalog
  // as site.announcementDismiss (a fixed a11y label, not config).

  /** CLIENT-SUPPLIED placeholder handles — data lives in brand.ts since G5. */
  socials: SOCIALS,

  /**
   * CLIENT-SUPPLIED. The store's own figures for its OLX and Instagram sales
   * history, rendered as the store's claims.
   *
   * These must NEVER feed aggregateRating structured data: the site emits real
   * review markup via seo.ts, and Google's structured-data policy prohibits
   * aggregate ratings that don't correspond to on-site reviews.
   */
  claims: {
    olxSales: "300+",
    instagramOrders: "100+",
    customerRating: null,
  } as ClientClaims,

  /**
   * Footer benefit strip — the concept screenshot's footer row.
   *
   * "Free delivery" (threshold) had its description RETRACTED, not merely
   * flagged unconfirmed: calculateOrderTotals() (src/lib/stripe.ts) and the
   * checkout confirm-order route always charge `shippingMethod?.price ?? 0`,
   * at any subtotal — no free-shipping threshold exists anywhere in the order
   * path. «Обмін розміру» / "Easy returns" was REMOVED outright (not just
   * reworded) — no such service exists, and it had no destination page
   * either. «Оплата при отриманні» (pay on delivery) is the offer being made.
   *
   * title/description moved to the catalog (TASK-039 G9) as
   * `footer.benefits.0..3.title/description`, addressed by index — order
   * here must stay in sync with that catalog order (delivery, COD, secure
   * payment, support), since Footer.tsx zips these icons with catalog text
   * positionally.
   */
  footerBenefits: [
    { icon: Truck },
    { icon: CreditCard },
    { icon: ShieldCheck },
    { icon: Headphones },
  ] as BenefitItem[],
};
