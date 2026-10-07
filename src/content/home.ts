import { Truck, ShieldCheck, Headphones, CreditCard } from "lucide-react";
import type { BenefitItem } from "./site";

// alt moved to the catalog (TASK-039 G9) as home.hero.imageAlt — a single
// fixed description independent of which photo is configured (the design
// handoff's photography swap keeps the same path/scene).
export interface HeroImage {
  src: string;
}

/**
 * Homepage copy. Single extraction point for TASK-039 i18n — these are plain
 * typed objects with no logic, the shape any i18n library can consume.
 *
 * Text content (headline, subtitle, CTA labels, whyChooseUs, testimonials
 * title, rail title/viewAllLabel) has moved to the `home` namespace in
 * messages/uk.json (TASK-039 G9) — this module now keeps only the
 * NON-translatable config: null-gates, hrefs, icons, and the image path.
 */
export const home = {
  hero: {
    // Removed 2026-07-28 — multi-brand store, user decision. Field kept
    // (config-gated) so a future single-brand campaign can set a string here
    // without a Hero code change; Hero renders the eyebrow row only when set.
    // Deliberately untranslated: this is campaign copy, not catalog content —
    // when set, Hero renders it verbatim regardless of active locale.
    eyebrow: null as string | null,
    // headline (was: brief's three lines, wrapped to the mockup's two
    // on 2026-07-28 — "СТИЛЬ. ЯКІСТЬ." / "ВПЕВНЕНІСТЬ.") and subtitle (was
    // BRAND_HERO_SUBTITLE) now live as home.hero.headline1/headline2/subtitle
    // in the catalog; Hero.tsx renders them via t().
    primaryCta: { href: "/products" },
    secondaryCta: {
      // `sort=new` (final-review Fix 4) — the current catalog sort param,
      // matching Header.tsx's nav "new" link (retargeted in 36e1737); the
      // legacy sortBy/sortOrder pair still works (products-content.tsx
      // forwards it if present) but this CTA should point at the current one.
      href: "/products?sort=new",
    },
    // Generated placeholder from the design handoff; real photography
    // replaces the file (same path) — content stays untouched.
    image: {
      src: "/images/hero-model-2.png",
    } as HeroImage | null,
  },

  // Handoff §4: «Безкоштовна доставка від 1000 грн» stays retracted;
  // «Обмін розміру» removed (no such service);
  // «Оплата при отриманні» is the offer being made — the benefit states it
  // as it is.
  // title/description moved to the catalog (TASK-039 G9) as
  // `home.benefits.0..3.title/description`, addressed by index — order here
  // must stay in sync (delivery, quality, support, COD), since Hero's page
  // composer zips these icons with catalog text positionally.
  benefits: [
    { icon: Truck },
    { icon: ShieldCheck },
    { icon: Headphones },
    { icon: CreditCard },
  ] as BenefitItem[],

  // whyChooseUs (title/intro/items) fully moved to the catalog (TASK-039 G9)
  // — WhyChooseUs.tsx no longer imports this module at all, only site.claims
  // (still config: which figures are real vs unset) plus useTranslations.

  rails: {
    newArrivals: {
      viewAllHref: "/products",
      // title/viewAllLabel moved to the catalog as
      // home.rails.newArrivals.title/viewAllLabel.
    },
  },

  // testimonials (title) fully moved to the catalog (TASK-039 G9) as
  // home.testimonials.title.
};
