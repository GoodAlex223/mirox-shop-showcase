import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { DEFAULT_BLUR_DATA_URL } from "@/lib/image-utils";
import { home } from "@/content/home";
import { Logo } from "@/components/common/Logo";

/**
 * Hero — brief list #1, first screen. The single most visible surface
 * in the rebrand, and the page's LCP element (PageSpeed 95+ target).
 *
 * One component, two layouts. With no configured image it renders centred and
 * typographic; with an image it renders a full-bleed split (text-left,
 * photo-right on desktop; photo-as-backdrop with bottom-anchored text on
 * mobile) with a CSS vignette over the photo. Both states are built to look
 * deliberate and finished on their own, so dropping the photo is a one-line
 * content change (`home.hero.image = null`), never a redesign.
 *
 * `BenefitStrip` is rendered by the page, not here (see page.tsx) — it moved
 * out of Hero so it can sit in its own bordered section between Hero and the
 * rest of the homepage.
 *
 * Every descendant here reads colour only from the semantic tokens
 * (background/foreground/muted-foreground/primary/...), never a hard-coded
 * shade — those tokens are the dark palette by default (see globals.css),
 * which is what keeps this safe against the collapsing bug documented for
 * TASK-034 (a fixed-shade descendant going invisible against the surface).
 */
export function Hero() {
  const { eyebrow, primaryCta, secondaryCta, image } = home.hero;
  const hasImage = image !== null;
  const t = useTranslations("home");
  // Two fixed catalog keys (TASK-039 G9), not an arbitrary-length config
  // array — headline is always exactly two lines now. Kept as a small array
  // (not two separate <span> blocks) so both layout branches below can keep
  // the existing .map()+stagger-delay rendering unchanged.
  const headline = [t("hero.headline1"), t("hero.headline2")];

  return (
    <section className="border-border bg-background text-foreground relative overflow-hidden border-b">
      {!hasImage && (
        <>
          {/* Layered near-black gradient backdrop. Inline style, not a Tailwind
              arbitrary value, so the gradient can't trip the utility parser. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(120% 120% at 50% 0%, var(--card) 0%, var(--background) 70%)",
            }}
          />
          {/* Fine grain texture (see .grain in globals.css). */}
          <div
            aria-hidden="true"
            className="grain pointer-events-none absolute inset-0 opacity-[0.035]"
          />
          {/* Oversized ghosted Mirox mark bleeding off the corner — the signature
              motif. aria-hidden keeps its role="img" out of the a11y tree. */}
          <div
            data-testid="hero-watermark"
            aria-hidden="true"
            className="pointer-events-none absolute -right-16 -bottom-24 opacity-[0.04]"
          >
            <Logo showText={false} size="lg" className="origin-bottom-right scale-[16]" />
          </div>
        </>
      )}
      {hasImage ? (
        <div className="relative lg:grid lg:grid-cols-[1fr_minmax(400px,44%)]">
          <div className="relative z-10 flex min-h-[560px] flex-col justify-end px-5 pb-10 lg:min-h-[620px] lg:justify-center lg:px-12 lg:pb-16 xl:pl-20">
            {eyebrow !== null && (
              <p className="text-muted-foreground flex items-center gap-3 text-xs font-medium tracking-[0.2em]">
                <span aria-hidden="true" className="bg-border-strong inline-block h-px w-6" />
                {eyebrow}
              </p>
            )}

            {/* Single h1: two content lines (home.hero.headline1/2), not two headings. */}
            <h1 className="font-heading mt-6 text-4xl leading-[1.08] font-extrabold tracking-tight sm:text-5xl lg:text-[64px] lg:leading-[1.05]">
              {headline.map((line, i) => (
                <span
                  key={line}
                  className="animate-fade-up block"
                  style={{ animationDelay: `${i * 90}ms` }}
                >
                  {line}
                </span>
              ))}
            </h1>

            <p className="text-muted-foreground mt-6 max-w-[420px] text-base lg:text-lg">
              {t("hero.subtitle")}
            </p>

            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link href={primaryCta.href}>{t("hero.primaryCta")}</Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href={secondaryCta.href}>{t("hero.secondaryCta")}</Link>
              </Button>
            </div>
          </div>

          {/*
            Outer photo column: mobile keeps the current full-bleed backdrop
            (absolute inset-0, matching the mobile mockup); from lg upward it
            becomes a normal grid cell in the 44% column, with lg:pr-20
            reserving the prototype's `padding:0 80px 0 0` mat between the
            photo and the viewport edge (handoff lines 60-61). It stays
            `lg:relative` (never `lg:static`) so it remains a positioned
            ancestor in its own right — with `static` here, the inner wrapper
            below would still size correctly, but a future absolutely
            positioned child added directly to this div would escape to the
            grid container (which spans BOTH columns) instead of staying
            inside this 44% column, which is exactly the "photo bleeds behind
            the text" bug this task fixes.
          */}
          <div className="absolute inset-0 lg:relative lg:order-2 lg:min-h-[620px] lg:pr-20">
            {/*
              Inner wrapper is the actual containing block for the `fill`
              image and the vignette. This extra layer is required, not
              decorative: a `position:relative` ancestor's padding does NOT
              constrain an absolutely-positioned `inset:0` child (the child's
              containing block is the padding EDGE, i.e. padding is included
              in — not subtracted from — the box the child fills). Without
              this inner div, `lg:pr-20` above would reserve dead space but
              the photo would still render edge-to-edge over it. Sizing this
              div to 100%/100% of the outer div's *content* box (the normal
              behavior of an in-flow percentage-sized block) is what actually
              applies the padding to the photo.
            */}
            <div className="relative h-full w-full lg:min-h-[620px]">
              <Image
                src={image.src}
                alt={t("hero.imageAlt")}
                fill
                // This is the LCP element: eager-loaded, explicitly sized, blurred-in.
                priority
                // From lg upward this image only occupies the 44% column, not
                // the full viewport width — requesting a full-width image there
                // over-fetches and costs LCP against the PageSpeed 95+ target.
                sizes="(max-width: 1024px) 100vw, 44vw"
                placeholder="blur"
                blurDataURL={DEFAULT_BLUR_DATA_URL}
                className="object-cover object-top"
              />
              {/* CSS vignette per the handoff — photo is swappable, effect persists.
                  Every stop derives from --background via color-mix (translucent
                  steps of the same token), honouring this file's no-hard-coded-shade
                  invariant; identical pixels to the prototype's rgba() stops while
                  the palette is black, and it tracks the token if that ever changes. */}
              <div
                data-testid="hero-vignette"
                aria-hidden="true"
                className="pointer-events-none absolute inset-0"
                style={{
                  background:
                    "linear-gradient(to top, var(--background) 0%, color-mix(in srgb, var(--background) 90%, transparent) 9%, color-mix(in srgb, var(--background) 0%, transparent) 45%), linear-gradient(to bottom, color-mix(in srgb, var(--background) 70%, transparent) 0%, color-mix(in srgb, var(--background) 0%, transparent) 16%), linear-gradient(to right, var(--background) 0%, color-mix(in srgb, var(--background) 55%, transparent) 6%, color-mix(in srgb, var(--background) 0%, transparent) 20%), linear-gradient(to left, var(--background) 0%, color-mix(in srgb, var(--background) 55%, transparent) 6%, color-mix(in srgb, var(--background) 0%, transparent) 20%)",
                }}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="relative container py-16 md:py-24">
          <div className="mx-auto max-w-3xl text-center">
            {eyebrow !== null && (
              <p className="text-muted-foreground text-xs font-medium tracking-[0.2em]">
                {eyebrow}
              </p>
            )}

            {/* Single h1: two content lines (home.hero.headline1/2), not two headings. */}
            <h1 className="font-heading mt-6 text-5xl leading-[0.95] font-extrabold tracking-tight sm:text-6xl lg:text-7xl">
              {headline.map((line, i) => (
                <span
                  key={line}
                  className="animate-fade-up block"
                  style={{ animationDelay: `${i * 90}ms` }}
                >
                  {line}
                </span>
              ))}
            </h1>

            <p className="text-muted-foreground mt-6 text-base sm:text-lg">{t("hero.subtitle")}</p>

            <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:justify-center">
              <Button asChild size="lg">
                <Link href={primaryCta.href}>{t("hero.primaryCta")}</Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href={secondaryCta.href}>{t("hero.secondaryCta")}</Link>
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
