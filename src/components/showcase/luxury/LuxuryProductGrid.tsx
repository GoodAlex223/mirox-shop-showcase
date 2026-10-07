import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Package } from "lucide-react";
import { formatPrice } from "@/lib/format";
import type { ProductGridProps, ShowcaseProduct } from "../types";

function LuxuryProductCard({ product }: { product: ShowcaseProduct }) {
  const hasDiscount =
    product.comparePrice && parseFloat(product.comparePrice) > parseFloat(product.price);
  const isOutOfStock = product.stock === 0;
  const imageUrl = product.images[0]?.url || "/placeholder.svg";

  return (
    <Link href={`/products/${product.slug}`} className="group block">
      <div className="border-border/50 hover:border-primary/30 relative overflow-hidden border transition-all duration-500">
        {/* Image container */}
        <div className="bg-muted/30 relative aspect-[3/4] overflow-hidden">
          <Image
            src={imageUrl}
            alt={product.images[0]?.alt || product.name}
            fill
            className="object-cover transition-all duration-700 group-hover:scale-105 group-hover:opacity-90"
          />

          {/* Minimal badge - top right */}
          {(hasDiscount || isOutOfStock) && (
            <div className="absolute top-4 right-4">
              <span className="text-primary bg-background/90 px-3 py-1.5 text-xs font-medium tracking-[0.15em] uppercase backdrop-blur-sm">
                {isOutOfStock ? "Sold Out" : "Sale"}
              </span>
            </div>
          )}

          {/* Hover overlay */}
          <div className="bg-background/0 group-hover:bg-background/10 absolute inset-0 transition-colors duration-500" />
        </div>

        {/* Content - generous padding */}
        <div className="p-6 text-center lg:p-8">
          {/* Category */}
          {product.category && (
            <p className="text-muted-foreground mb-3 text-xs tracking-[0.2em] uppercase">
              {product.category.name}
            </p>
          )}

          {/* Name - serif */}
          <h3 className="text-foreground group-hover:text-primary font-serif text-lg transition-colors duration-300">
            {product.name}
          </h3>

          {/* Decorative line */}
          <div className="bg-primary/30 mx-auto mt-4 h-px w-12" />

          {/* Price - elegant */}
          <div className="mt-4 flex items-baseline justify-center gap-3">
            <span className="text-foreground text-lg font-medium tracking-wide">
              {formatPrice(product.price)}
            </span>
            {hasDiscount && (
              <span className="text-muted-foreground text-sm line-through">
                {formatPrice(product.comparePrice!)}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

export function LuxuryProductGrid({
  products,
  title = "Featured Collection",
  showViewAll = true,
}: ProductGridProps) {
  return (
    <section className="py-24 md:py-32 lg:py-40">
      <div className="container">
        {/* Header - centered, elegant */}
        <div className="mb-16 text-center lg:mb-20">
          <div className="mb-6 inline-flex items-center gap-4">
            <span className="bg-primary/40 h-px w-12" />
            <span className="text-muted-foreground text-xs tracking-[0.3em] uppercase">
              Handpicked
            </span>
            <span className="bg-primary/40 h-px w-12" />
          </div>
          <h2 className="font-serif text-3xl font-medium tracking-tight sm:text-4xl md:text-5xl">
            {title}
          </h2>
        </div>

        {/* Product Grid - 3 columns with generous gap */}
        {products.length > 0 ? (
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3 lg:gap-12">
            {products.slice(0, 6).map((product) => (
              <LuxuryProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="border-border/50 border py-24 text-center">
            <Package className="text-muted-foreground/50 mx-auto h-12 w-12" />
            <p className="text-muted-foreground mt-6 font-serif text-lg">Collection coming soon</p>
          </div>
        )}

        {/* View all - elegant link */}
        {showViewAll && products.length > 0 && (
          <div className="mt-16 text-center lg:mt-20">
            <Link
              href="/products?featured=true"
              className="text-muted-foreground hover:text-primary group inline-flex items-center gap-3 text-sm tracking-[0.2em] uppercase transition-colors duration-300"
            >
              <span>View Full Collection</span>
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
