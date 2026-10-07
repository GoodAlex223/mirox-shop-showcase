export const dynamic = "force-dynamic";

import { getFeaturedProducts, getCategories, defaultFeatures } from "@/components/showcase";
import {
  LuxuryHero,
  LuxuryFeatures,
  LuxuryCategories,
  LuxuryProductGrid,
  LuxuryCTA,
} from "@/components/showcase/luxury";

export default async function LuxuryShowcasePage() {
  const [products, categories] = await Promise.all([getFeaturedProducts(6), getCategories(6)]);

  return (
    <div className="flex flex-col">
      <LuxuryHero />
      <LuxuryFeatures features={defaultFeatures} />
      <LuxuryCategories categories={categories} />
      <LuxuryProductGrid products={products} />
      <LuxuryCTA />
    </div>
  );
}
