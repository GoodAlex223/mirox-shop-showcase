import type { Metadata } from "next";
import Link from "next/link";
import { Instagram, Send, Music2, type LucideIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import {
  MANAGER_TELEGRAM_HREF,
  REVIEWS_CHANNEL_HREF,
  SOCIALS,
  type SocialLink,
} from "@/content/brand";
import { site } from "@/content/site";
import { Button } from "@/components/ui/button";

// lucide has no TikTok or Telegram brand glyph; Music2 and Send are the
// conventional stand-ins used elsewhere (SocialLinks.tsx) — kept in sync
// with that mapping rather than importing it, since it isn't exported.
const SOCIAL_ICONS: Record<SocialLink["platform"], LucideIcon> = {
  instagram: Instagram,
  tiktok: Music2,
  telegram: Send,
};

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pages.contact.meta");
  // Never set openGraph.images here — mergeStaticMetadata only merges the
  // segment's opengraph-image.tsx when openGraph.images is left unset.
  return { title: t("title"), description: t("description") };
}

/**
 * `/contact` — the bespoke page (G23 spec §5). Every other info page renders
 * through <StaticPage/>; this one has its own design (Mirox Contacts.dc.html)
 * and reads a dedicated `pages.contact` catalog namespace instead of that
 * shell's `sections` shape.
 *
 * Server Component by requirement, not by habit: `pages` is stripped out of
 * the storefront's client message payload (STOREFRONT_EXCLUDED_NAMESPACES in
 * src/i18n/client-namespaces.ts), so this must call `await getTranslations` — a
 * `"use client"` page or a `useTranslations` call here would render with an
 * empty namespace.
 */
export default async function ContactPage() {
  const t = await getTranslations("pages.contact");
  const deliveryItems = t.raw("delivery.items") as string[];
  const returnsItems = t.raw("returns.items") as string[];
  const { olxSales, instagramOrders } = site.claims;

  // CLIENT-SUPPLIED claims (src/content/site.ts). null renders
  // nothing for that stat — never a zero, never a placeholder — and neither
  // figure may ever feed structured data (StaticPage emits no JSON-LD; this
  // page must not start).
  const stats = [
    olxSales && { value: olxSales, label: t("stats.olx") },
    instagramOrders && { value: instagramOrders, label: t("stats.instagram") },
  ].filter((s): s is { value: string; label: string } => Boolean(s));

  return (
    <div className="container py-12 lg:py-16">
      <div className="max-w-xl">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{t("title")}</h1>
        <p className="text-muted-foreground mt-3 text-base leading-relaxed">{t("intro")}</p>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {SOCIALS.map((social) => {
          const Icon = SOCIAL_ICONS[social.platform];
          return (
            <a
              key={social.platform}
              href={social.href}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-card border-border hover-lift flex items-center gap-4 rounded-2xl border p-6 transition-colors"
            >
              <Icon className="h-6 w-6 shrink-0" aria-hidden="true" />
              <span className="font-semibold">{social.label}</span>
            </a>
          );
        })}
      </div>

      {/*
        Manager Telegram and the reviews channel (G23 §6/§5). Distinct from
        the SOCIALS grid above: `telegram` there is the shop CHANNEL
        (t.me/mirox_shop, broadcasts); this is the manager who answers, plus
        the separate reviews channel — neither is a SOCIALS entry.
      */}
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <a
          href={MANAGER_TELEGRAM_HREF}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-card border-border hover-lift flex items-center gap-4 rounded-2xl border p-6 transition-colors"
        >
          <Send className="h-6 w-6 shrink-0" aria-hidden="true" />
          <span className="font-semibold">{t("managerLabel")}</span>
        </a>
        <a
          href={REVIEWS_CHANNEL_HREF}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-card border-border hover-lift flex items-center gap-4 rounded-2xl border p-6 transition-colors"
        >
          <Send className="h-6 w-6 shrink-0" aria-hidden="true" />
          <span className="font-semibold">{t("reviewsLabel")}</span>
        </a>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <section className="bg-card border-border rounded-[20px] border p-7">
          <h2 className="text-lg font-bold tracking-tight">{t("delivery.heading")}</h2>
          <ul className="text-muted-foreground mt-4 list-disc space-y-2 pl-5 text-sm leading-relaxed">
            {deliveryItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <Link
            href="/shipping"
            className="mt-4 inline-block text-sm font-semibold underline underline-offset-4"
          >
            {t("delivery.moreLabel")}
          </Link>
        </section>

        <section className="bg-card border-border rounded-[20px] border p-7">
          <h2 className="text-lg font-bold tracking-tight">{t("returns.heading")}</h2>
          <ul className="text-muted-foreground mt-4 list-disc space-y-2 pl-5 text-sm leading-relaxed">
            {returnsItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <Link
            href="/returns"
            className="mt-4 inline-block text-sm font-semibold underline underline-offset-4"
          >
            {t("returns.moreLabel")}
          </Link>
        </section>
      </div>

      <section className="bg-card border-border mt-8 rounded-[20px] border p-8">
        <div className="grid grid-cols-1 items-center gap-8 md:grid-cols-2">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">{t("about.heading")}</h2>
            <p className="text-muted-foreground mt-3 text-[15px] leading-relaxed">
              {t("about.body")}
            </p>
          </div>

          {stats.length > 0 && (
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {stats.map((stat) => (
                <div
                  key={stat.label}
                  className="border-border bg-background rounded-2xl border p-5"
                >
                  <dt className="sr-only">{stat.label}</dt>
                  <dd>
                    <span className="block text-2xl font-extrabold">{stat.value}</span>
                    <span className="text-muted-foreground mt-1 block text-xs">{stat.label}</span>
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-bold tracking-tight">{t("form.heading")}</h2>
        <p className="text-muted-foreground mt-2 max-w-xl text-[15px] leading-relaxed">
          {t("form.body")}
        </p>
        <Button asChild className="mt-4">
          <Link href="/feedback">{t("form.cta")}</Link>
        </Button>
      </section>
    </div>
  );
}
