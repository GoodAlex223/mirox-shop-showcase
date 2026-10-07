export const dynamic = "force-dynamic";

import { getFeaturedProducts, getCategories, defaultFeatures } from "@/components/showcase";
import {
  OrganicHero,
  OrganicFeatures,
  OrganicCategories,
  OrganicProductGrid,
  OrganicCTA,
} from "@/components/showcase/organic";

export default async function OrganicShowcasePage() {
  const [products, categories] = await Promise.all([getFeaturedProducts(8), getCategories(6)]);

  return (
    <div className="flex flex-col">
      <OrganicHero />
      <OrganicFeatures features={defaultFeatures} />
      <OrganicCategories categories={categories} />
      <OrganicProductGrid products={products} />
      <OrganicCTA />
    </div>
  );
}
