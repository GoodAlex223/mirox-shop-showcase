export const dynamic = "force-dynamic";

import { getFeaturedProducts, getCategories, defaultFeatures } from "@/components/showcase";
import {
  BoldHero,
  BoldFeatures,
  BoldCategories,
  BoldProductGrid,
  BoldCTA,
} from "@/components/showcase/bold";

export default async function BoldShowcasePage() {
  const [products, categories] = await Promise.all([getFeaturedProducts(8), getCategories(6)]);

  return (
    <div className="flex flex-col">
      <BoldHero />
      <BoldFeatures features={defaultFeatures} />
      <BoldCategories categories={categories} />
      <BoldProductGrid products={products} />
      <BoldCTA />
    </div>
  );
}
