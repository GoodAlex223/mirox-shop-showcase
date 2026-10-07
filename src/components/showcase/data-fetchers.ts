import { prisma } from "@/lib/db";
import type { ShowcaseProduct, ShowcaseCategory, ShowcaseFeature } from "./types";
import { Package, Truck, Shield, CreditCard } from "lucide-react";

/**
 * Fetch featured products for showcase pages
 */
export async function getFeaturedProducts(limit = 8): Promise<ShowcaseProduct[]> {
  const products = await prisma.product.findMany({
    where: {
      isActive: true,
      isFeatured: true,
    },
    select: {
      id: true,
      name: true,
      slug: true,
      shortDesc: true,
      price: true,
      comparePrice: true,
      stock: true,
      isFeatured: true,
      category: { select: { name: true, slug: true } },
      images: {
        select: { url: true, alt: true },
        orderBy: { position: "asc" },
        take: 1,
      },
    },
    take: limit,
    orderBy: { createdAt: "desc" },
  });

  // Convert Decimal to string for serialization
  return products.map((p) => ({
    ...p,
    price: p.price.toString(),
    comparePrice: p.comparePrice?.toString() ?? null,
  }));
}

/**
 * Fetch categories for showcase pages
 */
export async function getCategories(limit = 4): Promise<ShowcaseCategory[]> {
  const categories = await prisma.category.findMany({
    where: {
      isActive: true,
      parentId: null,
    },
    select: {
      id: true,
      name: true,
      slug: true,
      image: true,
      _count: {
        select: {
          products: { where: { isActive: true } },
        },
      },
    },
    take: limit,
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  return categories.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    image: c.image,
    productCount: c._count.products,
  }));
}

/**
 * Default features for showcase pages
 */
export const defaultFeatures: ShowcaseFeature[] = [
  {
    icon: Package,
    title: "Wide Selection",
    description: "Browse thousands of products across multiple categories.",
  },
  {
    icon: Truck,
    title: "Fast Shipping",
    description: "Quick delivery from our trusted supplier network.",
  },
  {
    icon: Shield,
    title: "Secure Shopping",
    description: "Your data and payments are always protected.",
  },
  {
    icon: CreditCard,
    title: "Easy Payments",
    description: "Multiple payment options for your convenience.",
  },
];
