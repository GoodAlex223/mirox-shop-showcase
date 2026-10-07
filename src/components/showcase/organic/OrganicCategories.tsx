import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { ArrowRight, Leaf, Package } from "lucide-react";
import type { CategoriesProps } from "../types";

export function OrganicCategories({
  categories,
  title = "Shop by Category",
  showViewAll = true,
}: CategoriesProps) {
  if (categories.length === 0) return null;

  return (
    <section className="bg-secondary/30 py-16 md:py-24">
      <div className="container">
        {/* Header */}
        <div className="mb-12 text-center">
          <div className="mb-4 inline-flex items-center gap-3">
            <Leaf className="text-primary h-5 w-5" />
            <span className="text-muted-foreground text-sm font-medium">Explore</span>
          </div>
          <h2 className="font-serif text-3xl font-medium tracking-tight sm:text-4xl">{title}</h2>
        </div>

        {/* Categories - pill-shaped cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => (
            <Link
              key={category.id}
              href={`/categories/${category.slug}`}
              className="group relative"
            >
              <div className="bg-card relative overflow-hidden rounded-[2rem] shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
                {/* Image section */}
                <div className="relative h-40 overflow-hidden">
                  {category.image ? (
                    <>
                      <Image
                        src={category.image}
                        alt={category.name}
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      {/* Earth-tone overlay */}
                      <div className="from-background/90 via-background/40 absolute inset-0 bg-gradient-to-t to-transparent" />
                    </>
                  ) : (
                    <div className="from-primary/20 to-accent/20 flex h-full items-center justify-center bg-gradient-to-br">
                      <Package className="text-primary/40 h-12 w-12" />
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="p-6">
                  <h3 className="text-foreground group-hover:text-primary font-serif text-xl transition-colors duration-300">
                    {category.name}
                  </h3>
                  <div className="mt-2 flex items-center justify-between">
                    <p className="text-muted-foreground text-sm">
                      {category.productCount} products
                    </p>
                    <ArrowRight className="text-muted-foreground/50 group-hover:text-primary h-5 w-5 transition-all duration-300 group-hover:translate-x-1" />
                  </div>
                </div>

                {/* Decorative corner */}
                <div className="bg-background/80 absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-full opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100">
                  <Leaf className="text-primary h-4 w-4" />
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* View all */}
        {showViewAll && (
          <div className="mt-10 text-center">
            <Link href="/categories">
              <Button variant="outline" className="gap-2 rounded-full px-8">
                View All Categories
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
