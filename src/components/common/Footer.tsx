import Link from "next/link";
import { useTranslations } from "next-intl";
import { BenefitStrip } from "@/components/common/BenefitStrip";
import { SocialLinks } from "@/components/common/SocialLinks";
import { NewsletterSignup } from "./NewsletterSignup";
import { site } from "@/content/site";
import { DEVELOPER_CREDIT_HREF } from "@/content/brand";

/**
 * Footer link groups. Exported because tests/unit/nav-link-integrity.test.ts
 * asserts every internal href here resolves to a real route file — the
 * executable form of the no-dead-links rule (user ruling 2026-07-28).
 *
 * `key` (not the label) is the stable identity; `as const` narrows it to
 * the literal union next-intl's typed catalog keys require.
 */
export const SHOP_LINK_GROUPS = [
  {
    key: "shop",
    links: [
      { key: "catalog", href: "/products" },
      { key: "categories", href: "/categories" },
      { key: "new", href: "/products?sortBy=createdAt&sortOrder=desc" },
      { key: "track", href: "/track" },
      { key: "feedback", href: "/feedback" },
    ],
  },
  {
    key: "info",
    links: [
      { key: "about", href: "/about" },
      { key: "shipping", href: "/shipping" },
      { key: "returns", href: "/returns" },
      { key: "faq", href: "/faq" },
      { key: "contact", href: "/contact" },
      { key: "privacy", href: "/privacy" },
      { key: "terms", href: "/terms" },
    ],
  },
] as const;

export function Footer() {
  const t = useTranslations("footer");
  const tBrand = useTranslations("brand");

  // title/description moved to the catalog (TASK-039 G9) as
  // footer.benefits.0..3.title/description, addressed by index — order must
  // stay in sync with site.footerBenefits (see that array's own comment).
  // Manually unrolled (not .map()'d): a .map() callback's index is typed
  // `number`, which can't narrow to the literal "0"|"1"|"2"|"3" the catalog's
  // typed keys require — these four literal t() calls keep typo protection.
  const benefitItems = [
    {
      icon: site.footerBenefits[0].icon,
      title: t("benefits.0.title"),
      description: t("benefits.0.description"),
    },
    {
      icon: site.footerBenefits[1].icon,
      title: t("benefits.1.title"),
      description: t("benefits.1.description"),
    },
    {
      icon: site.footerBenefits[2].icon,
      title: t("benefits.2.title"),
      description: t("benefits.2.description"),
    },
    {
      icon: site.footerBenefits[3].icon,
      title: t("benefits.3.title"),
      description: t("benefits.3.description"),
    },
  ];

  return (
    <footer className="border-border bg-background text-foreground border-t">
      {/* Benefit row + socials (handoff footer, row 1) */}
      <div className="container flex flex-col gap-8 py-8 lg:flex-row lg:items-center lg:justify-between">
        <BenefitStrip
          items={benefitItems}
          className="grow gap-6 bg-transparent lg:grid-cols-4 [&>li]:bg-transparent [&>li]:px-0 [&>li]:py-0"
        />
        <div className="flex items-center gap-4">
          <span className="text-muted-foreground text-xs font-semibold">{t("followUs")}</span>
          <SocialLinks className="flex items-center gap-4" />
        </div>
      </div>

      {/* Newsletter — deviation from the mockup: the double-opt-in feature
          exists and keeps its entry point; slim row instead of a column. */}
      <div className="border-border border-t">
        <div className="container flex flex-col items-start justify-between gap-4 py-6 lg:flex-row lg:items-center">
          <p className="text-muted-foreground text-sm">{t("newsletterBlurb")}</p>
          <NewsletterSignup />
        </div>
      </div>

      {/* Link groups band — Магазин / Інформація, added G23 (TASK-055
          Task 8). Grid, not the copyright row's flex-wrap: twelve links
          across two labelled columns need their own layout, not another
          shove into the row the G20 overflow fix already constrains.
          `grid-cols-1` declared explicitly — implicit grid tracks overflow
          on mobile in this codebase (recorded lesson). */}
      <div className="border-border border-t">
        <div className="container grid grid-cols-1 gap-8 py-10 sm:grid-cols-2 lg:grid-cols-4">
          {SHOP_LINK_GROUPS.map((group) => (
            <div key={group.key}>
              <h3 className="text-foreground text-sm font-semibold">{t(`groups.${group.key}`)}</h3>
              <nav className="mt-4 flex flex-col gap-2">
                {group.links.map((l) => (
                  <Link
                    key={l.key}
                    href={l.href}
                    className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                  >
                    {t(`links.${l.key}`)}
                  </Link>
                ))}
              </nav>
            </div>
          ))}
        </div>
      </div>

      {/* Copyright row */}
      <div className="border-border text-faint border-t">
        {/* flex-wrap, not plain flex: the five UA labels this row used to hold
            totaled ~380px, which does not fit 358px of container at a 390px
            viewport, and flex items refuse to shrink below their content — so
            an unwrapped row pushed the whole DOCUMENT to 396px and every page
            carrying the footer scrolled sideways by 6px (found by the G20
            visual gate; guarded by tests/e2e/mobile-overflow.spec.ts).
            Asymmetric gaps because the row gap only ever applies once
            wrapping happens, where 24px between stacked lines reads as a gap
            in the row rather than line spacing. The links themselves moved to
            the grouped band above (G23/TASK-055 Task 8); this row now holds
            only the brand line (Task 9 adds the developer credit as its
            second element), but the wrap/gap fix stays — the same overflow
            risk applies to any second element sharing the row. Desktop is
            unchanged: at `lg` the content fits on one line and never wraps. */}
        <div className="container flex flex-wrap items-start justify-between gap-x-6 gap-y-2 py-5 text-[12.5px] lg:items-center">
          <span>
            &copy; {new Date().getFullYear()} {site.name}. {tBrand("tagline")}
          </span>
          <span>
            {t("developerCredit")}{" "}
            <a
              href={DEVELOPER_CREDIT_HREF}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground underline underline-offset-4 transition-colors"
            >
              GoodAlex223
            </a>
          </span>
        </div>
      </div>
    </footer>
  );
}
