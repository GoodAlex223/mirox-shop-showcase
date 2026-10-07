import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { ArrowRight, Package } from "lucide-react";
import type { CategoriesProps } from "../types";

export function BoldCategories({
  categories,
  title = "Shop by Category",
  showViewAll = true,
}: CategoriesProps) {
  if (categories.length === 0) return null;

  return (
    <section className="bg-muted/30 py-20 md:py-28">
      <div className="container">
        {/* Header */}
        <div className="mb-10 flex items-end justify-between">
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl md:text-5xl">
              {title}
            </h2>
            <p className="text-muted-foreground mt-2">Find exactly what you&apos;re looking for</p>
          </div>
          {showViewAll && (
            <Link
              href="/categories"
              className="text-primary hidden items-center gap-2 font-bold hover:underline sm:flex"
            >
              View All
              <ArrowRight className="h-5 w-5" />
            </Link>
          )}
        </div>

        {/* Horizontal scroll container */}
        <div className="scrollbar-hide relative -mx-4 overflow-x-auto px-4 pb-4">
          <div className="flex min-w-max gap-6">
            {categories.map((category, index) => (
              <Link
                key={category.id}
                href={`/categories/${category.slug}`}
                className="group relative w-72 flex-shrink-0 md:w-80"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="relative aspect-[4/3] overflow-hidden rounded-2xl shadow-xl transition-all duration-300 group-hover:scale-[1.02] group-hover:shadow-2xl">
                  {/* Background image or gradient */}
                  {category.image ? (
                    <Image
                      src={category.image}
                      alt={category.name}
                      fill
                      sizes="320px"
                      className="object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                  ) : (
                    <div className="from-primary via-primary/80 to-accent absolute inset-0 bg-gradient-to-br" />
                  )}

                  {/* Gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />

                  {/* Content */}
                  <div className="absolute inset-0 flex flex-col justify-end p-6">
                    <h3 className="text-2xl font-extrabold text-white drop-shadow-lg">
                      {category.name}
                    </h3>
                    <p className="mt-1 font-medium text-white/80">
                      {category.productCount} products
                    </p>

                    {/* Animated arrow */}
                    <div className="mt-4 flex items-center gap-2 font-bold text-white">
                      <span className="text-sm tracking-wider uppercase">Explore</span>
                      <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-2" />
                    </div>
                  </div>

                  {/* Decorative corner */}
                  <div className="absolute top-4 right-4 flex h-12 w-12 items-center justify-center rounded-full bg-white/20 opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100">
                    <Package className="h-6 w-6 text-white" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="mt-6 flex justify-center gap-2 sm:hidden">
          {categories.map((_, index) => (
            <div key={index} className="bg-primary/30 h-2 w-2 rounded-full" />
          ))}
        </div>

        {/* Mobile view all */}
        {showViewAll && (
          <div className="mt-8 text-center sm:hidden">
            <Link href="/categories">
              <Button variant="outline" className="font-bold">
                View All Categories
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
