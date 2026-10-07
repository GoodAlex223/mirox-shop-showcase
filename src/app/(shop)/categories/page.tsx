export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import Image from "next/image";
import { Package } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { prisma } from "@/lib/db";
import { getCategoriesListingMetadata } from "@/lib/seo";

// Task 8: getCategoriesListingMetadata is now async (reads the "seo" i18n namespace).
export async function generateMetadata(): Promise<Metadata> {
  return getCategoriesListingMetadata();
}

async function getCategories() {
  const categories = await prisma.category.findMany({
    where: {
      isActive: true,
      parentId: null,
    },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      image: true,
      children: {
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          slug: true,
          _count: {
            select: { products: { where: { isActive: true } } },
          },
        },
        orderBy: { sortOrder: "asc" },
      },
      _count: {
        select: { products: { where: { isActive: true } } },
      },
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  return categories;
}

export default async function CategoriesPage() {
  const [categories, t] = await Promise.all([getCategories(), getTranslations("categories")]);

  return (
    <div className="container py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground mt-2">{t("subtitle")}</p>
      </div>

      {/* Categories Grid */}
      {categories.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Package className="text-muted-foreground h-16 w-16" />
          <h2 className="mt-4 text-xl font-semibold">{t("empty.title")}</h2>
          <p className="text-muted-foreground mt-2">{t("empty.description")}</p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => {
            const totalProducts =
              category._count.products +
              category.children.reduce((sum, child) => sum + child._count.products, 0);

            return (
              <Link key={category.id} href={`/products?category=${category.slug}`}>
                <Card className="group h-full overflow-hidden transition-shadow hover:shadow-lg">
                  <div className="bg-muted relative aspect-[16/9]">
                    {category.image ? (
                      <Image
                        src={category.image}
                        alt={category.name}
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="from-primary/20 to-primary/5 flex h-full items-center justify-center bg-gradient-to-br">
                        <Package className="text-primary/50 h-16 w-16" />
                      </div>
                    )}
                  </div>
                  <CardContent className="p-5">
                    <h2 className="group-hover:text-primary text-xl font-semibold">
                      {category.name}
                    </h2>
                    {category.description && (
                      <p className="text-muted-foreground mt-2 line-clamp-2 text-sm">
                        {category.description}
                      </p>
                    )}
                    <p className="text-primary mt-3 text-sm font-medium">
                      {t("productCount", { count: totalProducts })}
                    </p>

                    {/* Subcategories */}
                    {category.children.length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {category.children.slice(0, 4).map((child) => (
                          <span
                            key={child.id}
                            className="bg-muted rounded-full px-3 py-1 text-xs font-medium"
                          >
                            {child.name}
                          </span>
                        ))}
                        {category.children.length > 4 && (
                          <span className="bg-muted rounded-full px-3 py-1 text-xs font-medium">
                            {t("moreCategories", { count: category.children.length - 4 })}
                          </span>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
