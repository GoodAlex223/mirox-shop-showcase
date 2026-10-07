import { useTranslations } from "next-intl";
import { FadeIn } from "@/components/common/FadeIn";
import { site } from "@/content/site";

/**
 * "Why choose us" — a dark "by the numbers" block. The three checkable claims
 * (site.claims) render as stat cards, each gated on a configured figure so no
 * number is fabricated. The six brand-voice items render as a quiet supporting
 * grid. None of these may feed aggregateRating structured data — see site.ts.
 *
 * 2-column layout per Mirox Home.dc.html:141-167: left column is
 * title/intro/stats, right column is the brand-voice item grid.
 *
 * All copy (title/intro/items/stat labels) lives in the catalog under
 * home.whyChooseUs.* since TASK-039 G9 — this component no longer imports
 * @/content/home at all, only site.claims (still config: which figures are
 * real vs unset).
 */
export function WhyChooseUs() {
  const t = useTranslations("home.whyChooseUs");
  const title = t("title");
  const intro = t("intro");
  // Manually unrolled (not .map()'d over a range): a .map() callback's index
  // is typed `number`, which can't narrow to the literal "0".."5" the
  // catalog's typed keys require — six literal t() calls keep typo
  // protection (same reasoning as Footer.tsx's benefitItems).
  const items = [
    t("items.0"),
    t("items.1"),
    t("items.2"),
    t("items.3"),
    t("items.4"),
    t("items.5"),
  ];
  const { olxSales, instagramOrders, customerRating } = site.claims;

  const stats = [
    olxSales && { value: olxSales, label: t("stats.olxSales") },
    instagramOrders && { value: instagramOrders, label: t("stats.instagramOrders") },
    customerRating && { value: customerRating, label: t("stats.customerRating") },
  ].filter((s): s is { value: string; label: string } => Boolean(s));

  return (
    <section className="border-border border-t py-16 lg:py-[72px]">
      <div className="container grid gap-12 lg:grid-cols-2 lg:gap-16">
        <FadeIn>
          <h2 className="font-heading text-2xl font-extrabold tracking-tight sm:text-[32px]">
            {title}
          </h2>
          <p className="text-muted-foreground mt-4 max-w-[420px] text-[15px] leading-relaxed">
            {intro}
          </p>

          {stats.length > 0 && (
            <dl className="mt-8 flex gap-4">
              {stats.map((stat) => (
                <div
                  key={stat.label}
                  className="bg-card border-border flex-1 rounded-2xl border px-7 py-6"
                >
                  <dt className="sr-only">{stat.label}</dt>
                  <dd>
                    <span className="font-heading block text-[32px] font-extrabold">
                      {stat.value}
                    </span>
                    <span className="text-muted-foreground mt-1 block text-[13px]">
                      {stat.label}
                    </span>
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </FadeIn>

        {/*
          lg:grid lg:items-center lives on the WRAPPER, not the <ul> — this is
          the fix for a gate-round-2 bug where the checklist sat top-anchored
          instead of centered against the left column's (taller) height. The
          outer grid above already stretches this FadeIn to match the left
          column (default align-items:stretch), but FadeIn just renders a
          plain block <div>: a block child (the <ul>) never auto-fills a
          parent's height, so the <ul> only ever grows to its own content's
          height and sits at the top of the stretched-but-otherwise-empty
          wrapper. `content-center` on the <ul> itself (the original, broken
          attempt) computes fine but is a total no-op, because the <ul>'s own
          box is already exactly as tall as its content — there is no extra
          space *inside* the <ul> for align-content to redistribute; the
          extra space is one level up, in this wrapper, which the <ul>'s own
          alignment can never reach. Making the wrapper itself lg:grid
          lg:items-center centers the <ul> (a single item, natural height)
          within the wrapper's already-stretched box instead — matching the
          handoff (Mirox Home.dc.html:158's align-content:center, which works
          there because that prototype has no such wrapper in between).
          justify-items defaults to stretch in a grid container, so the <ul>
          keeps its full width with no extra class needed. lg:-gated so
          mobile's single-column stacking (each side its own row, nothing to
          center against) is untouched.
        */}
        <FadeIn className="lg:grid lg:items-center">
          <ul className="grid gap-3 sm:grid-cols-2">
            {items.map((item) => (
              <li key={item} className="flex items-center gap-2.5">
                <span
                  aria-hidden="true"
                  className="bg-foreground h-1.5 w-1.5 shrink-0 rounded-full"
                />
                <span className="text-foreground/85 text-sm font-semibold">{item}</span>
              </li>
            ))}
          </ul>
        </FadeIn>
      </div>
    </section>
  );
}
