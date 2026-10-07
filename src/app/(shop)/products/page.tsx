import type { Metadata } from "next";
import { getProductsListingMetadata } from "@/lib/seo";
import ProductsContent from "./products-content";

export const dynamic = "force-dynamic";

// Task 8: getProductsListingMetadata is now async (reads the "seo" i18n namespace).
export async function generateMetadata(): Promise<Metadata> {
  return getProductsListingMetadata();
}

export default function ProductsPage() {
  return <ProductsContent />;
}
