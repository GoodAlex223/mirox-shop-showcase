import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ProductCard } from "@/components/products";
import { FadeIn } from "@/components/common/FadeIn";
import type { ProductCardData } from "@/lib/product-queries";

interface ProductRailProps {
  title: string;
  products: ProductCardData[];
  viewAllHref: string;
  viewAllLabel: string;
}

/**
 * A titled row of products. Renders nothing when empty, so a new store gets a
 * shorter coherent page rather than an empty rail.
 */
export function ProductRail({ title, products, viewAllHref, viewAllLabel }: ProductRailProps) {
  if (products.length === 0) return null;

  return (
    <section className="container py-16">
      <FadeIn>
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">{title}</h2>
          <Link
            href={viewAllHref}
            className="hover:text-muted-foreground text-sm font-medium transition-colors"
          >
            {viewAllLabel}
            <ArrowRight className="ml-1 inline h-4 w-4" />
          </Link>
        </div>

        {/*
         * Two layout modes on one element (G20). Below `sm:` this is a
         * horizontal scroller of 160px cards per `Mirox Mobile.dc.html`;
         * from `sm:` up it is the grid the rail has always been, untouched.
         *
         * `-mr-4 pr-4` cancels the `.container` inset on the right only, so
         * cards run off the viewport edge instead of stopping at a padding
         * line — the mockup's "there is more here" affordance. The two must
         * stay equal to each other AND to `.container`'s own `px-4`;
         * product-rail.test.tsx reads that value out of globals.css and
         * fails if any of the three drift apart.
         *
         * Deliberately absent: scroll-snap (not in the mockup), a
         * scrollbar-hiding utility (mobile scrollbars already overlay, and
         * skipping it avoids Tailwind v4's @layer drop), and `tabIndex` on
         * the scroller (its children are links, so it is already keyboard
         * reachable — a tabindex here would add a redundant desktop stop).
         */}
        <div
          data-testid="product-rail-scroller"
          className="mt-8 -mr-4 flex gap-6 overflow-x-auto pr-4 sm:mr-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:pr-0 md:grid-cols-3 lg:grid-cols-4"
        >
          {products.map((product) => (
            // Fixed width below `sm:`, released to the grid track above it.
            // Both flex and grid items stretch by default, so ProductCard's
            // `h-full` equal-height layout survives the mode switch.
            <div
              key={product.id}
              data-testid="product-rail-item"
              className="w-40 shrink-0 sm:w-auto"
            >
              <ProductCard product={product} />
            </div>
          ))}
        </div>
      </FadeIn>
    </section>
  );
}
