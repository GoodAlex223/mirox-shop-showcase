import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { CategoriesProps } from "../types";

export function LuxuryCategories({
  categories,
  title = "Shop by Category",
  showViewAll = true,
}: CategoriesProps) {
  if (categories.length === 0) return null;

  return (
    <section className="bg-muted/20 py-24 md:py-32 lg:py-40">
      <div className="container">
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
          {/* Left header - sticky */}
          <div className="lg:sticky lg:top-24 lg:col-span-4 lg:self-start">
            <div className="mb-6 inline-flex items-center gap-4">
              <span className="bg-primary/40 h-px w-12" />
              <span className="text-muted-foreground text-xs tracking-[0.3em] uppercase">
                Categories
              </span>
            </div>
            <h2 className="font-serif text-3xl font-medium tracking-tight sm:text-4xl">{title}</h2>
            <p className="text-muted-foreground mt-6 leading-relaxed">
              Explore our curated categories, each thoughtfully assembled with the finest
              selections.
            </p>
            {showViewAll && (
              <Link
                href="/categories"
                className="text-muted-foreground hover:text-primary group mt-8 inline-flex items-center gap-3 text-sm tracking-[0.2em] uppercase transition-colors duration-300"
              >
                <span>View All</span>
                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
            )}
          </div>

          {/* Right - category list */}
          <div className="lg:col-span-8">
            <div className="divide-border/50 divide-y">
              {categories.map((category, index) => (
                <Link
                  key={category.id}
                  href={`/categories/${category.slug}`}
                  className="group block py-8 first:pt-0 last:pb-0"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-8">
                      {/* Index number */}
                      <span className="text-muted-foreground/50 text-sm font-medium">
                        {String(index + 1).padStart(2, "0")}
                      </span>

                      {/* Category info */}
                      <div>
                        <h3 className="text-foreground group-hover:text-primary font-serif text-xl transition-colors duration-300">
                          {category.name}
                        </h3>
                        {/* Gold underline on hover */}
                        <div className="bg-primary mt-2 h-px w-0 transition-all duration-500 group-hover:w-full" />
                        <p className="text-muted-foreground mt-3 text-sm">
                          {category.productCount} {category.productCount === 1 ? "item" : "items"}
                        </p>
                      </div>
                    </div>

                    {/* Arrow */}
                    <ArrowRight className="text-muted-foreground/30 group-hover:text-primary h-5 w-5 transition-all duration-300 group-hover:translate-x-2" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
