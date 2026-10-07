import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getHomeMetadata } from "@/lib/seo";
import { getNewArrivals, type ProductCardData } from "@/lib/product-queries";
import { getTestimonials, type Testimonial } from "@/lib/review-queries";
import { safeSection } from "@/lib/safe-section";
import { BenefitStrip } from "@/components/common";
import { Hero, ProductRail, Testimonials, WhyChooseUs } from "@/components/home";
import { home } from "@/content/home";

// Task 8: getHomeMetadata is now async (reads brand.description/metaSuffix
// from the request-scoped i18n catalog).
export async function generateMetadata(): Promise<Metadata> {
  return getHomeMetadata();
}

// Kept as force-dynamic, NOT switched to `revalidate = 300` ISR. Verified
// against a real `npm run build`: the root layout (src/app/layout.tsx) declares
// its own `export const dynamic = "force-dynamic"` because the app renders
// client-side auth context that doesn't survive static prerendering — that
// setting is inherited by every route and overrides any page-level revalidate,
// which is exactly what the build showed (`/` still listed as `ƒ (Dynamic)`
// with `revalidate = 300` set here). Confirmed the mechanism, not just the
// symptom: temporarily removing the root layout's force-dynamic and rebuilding
// made prerendering fail outright for "/" and 7 other routes with `TypeError:
// Cannot read properties of null (reading 'useContext')` — i.e. this is a
// real, load-bearing, pre-existing constraint (not a Prisma/Neon adapter
// issue, which is what motivated this check), and changing it is a site-wide
// decision well outside a homepage-composition task.
export const dynamic = "force-dynamic";

// Two small, NON-async local helpers own this page's own two translated
// fragments (the benefits section's aria-label + items, the rail's
// title/viewAllLabel). Deliberately NOT inlined into the async HomePage
// function body below (TASK-039 G9): next-intl's `useTranslations` (the
// hook) is the only translation API proven to work for this component —
// `getTranslations` (the async-server-component API the repo's binding i18n
// convention would otherwise call for here) throws
// "`getTranslations` is not supported in Client Components" when the render
// tree is exercised directly by Vitest/RTL (`render(await HomePage())` in
// tests/unit/home-page.test.tsx), because Vitest resolves next-intl's
// package exports via the same condition real Client Components use — it has
// no concept of the React Server Components module graph Next's own bundler
// builds. `useTranslations` inside a plain (non-async) component sidesteps
// that entirely and is next-intl's documented, supported pattern for exactly
// this composition (translated leaf content inside an async Server
// Component's tree) — HomePage itself calls no next-intl API at all.
function HomeBenefitsSection() {
  const t = useTranslations("home");
  // title/description addressed by index (TASK-039 G9) — manually unrolled,
  // not `.map()`'d, so every key stays a type-checked literal (see
  // Footer.tsx's benefitItems for the identical reasoning).
  const items = [
    {
      icon: home.benefits[0].icon,
      title: t("benefits.0.title"),
      description: t("benefits.0.description"),
    },
    {
      icon: home.benefits[1].icon,
      title: t("benefits.1.title"),
      description: t("benefits.1.description"),
    },
    {
      icon: home.benefits[2].icon,
      title: t("benefits.2.title"),
      description: t("benefits.2.description"),
    },
    {
      icon: home.benefits[3].icon,
      title: t("benefits.3.title"),
      description: t("benefits.3.description"),
    },
  ];
  return (
    <section aria-label={t("benefitsAriaLabel")} className="border-border border-b">
      <BenefitStrip items={items} />
    </section>
  );
}

function HomeNewArrivalsRail({ products }: { products: ProductCardData[] }) {
  const t = useTranslations("home");
  return (
    <ProductRail
      title={t("rails.newArrivals.title")}
      products={products}
      viewAllHref={home.rails.newArrivals.viewAllHref}
      viewAllLabel={t("rails.newArrivals.viewAllLabel")}
    />
  );
}

export default async function HomePage() {
  // One section's data query failing must not 500 the whole homepage: every
  // rail and the testimonials block already render nothing when handed an empty
  // result, so a failed query degrades to a missing section instead. This is
  // exactly the failure that took the homepage down once a server-side review
  // query landed here — the production `reviews` table had never been migrated,
  // so getTestimonials() threw and Promise.all rejected the entire render. With
  // `dynamic = "force-dynamic"` this runs per request, so a transient DB blip
  // also self-heals on the next load rather than sticking.
  const [newArrivals, testimonials] = await Promise.all([
    safeSection<ProductCardData[]>(getNewArrivals(4), [], "home:new-arrivals"),
    safeSection<Testimonial[]>(getTestimonials(6), [], "home:testimonials"),
  ]);

  return (
    <div className="flex flex-col">
      <Hero />
      <HomeBenefitsSection />
      <HomeNewArrivalsRail products={newArrivals} />
      <WhyChooseUs />
      <Testimonials testimonials={testimonials} />
    </div>
  );
}
