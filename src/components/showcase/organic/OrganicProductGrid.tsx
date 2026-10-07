import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { ArrowRight, Heart, Package, Leaf } from "lucide-react";
import { formatPrice } from "@/lib/format";
import type { ProductGridProps, ShowcaseProduct } from "../types";

function OrganicProductCard({ product }: { product: ShowcaseProduct }) {
  const hasDiscount =
    product.comparePrice && parseFloat(product.comparePrice) > parseFloat(product.price);
  const isOutOfStock = product.stock === 0;
  const imageUrl = product.images[0]?.url || "/placeholder.svg";

  return (
    <Link href={`/products/${product.slug}`} className="group block">
      <div className="bg-card relative overflow-hidden rounded-3xl shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
        {/* Image container */}
        <div className="bg-muted/50 relative aspect-square overflow-hidden rounded-t-3xl">
          <Image
            src={imageUrl}
            alt={product.images[0]?.alt || product.name}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />

          {/* Warm overlay on hover */}
          <div className="bg-accent/0 group-hover:bg-accent/5 absolute inset-0 transition-colors duration-300" />

          {/* Badges - organic pill style */}
          <div className="absolute top-4 left-4 flex flex-col gap-2">
            {hasDiscount && (
              <span className="bg-accent/90 text-accent-foreground inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium">
                <Leaf className="h-3 w-3" />
                Sale
              </span>
            )}
            {isOutOfStock && (
              <span className="bg-muted text-muted-foreground rounded-full px-3 py-1.5 text-xs font-medium">
                Out of Stock
              </span>
            )}
          </div>

          {/* Wishlist button */}
          <button className="bg-background/80 hover:bg-background absolute top-4 right-4 flex h-10 w-10 items-center justify-center rounded-full opacity-0 backdrop-blur-sm transition-all duration-300 group-hover:opacity-100 hover:scale-110">
            <Heart className="text-muted-foreground h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5">
          {/* Category */}
          {product.category && (
            <p className="text-primary mb-2 text-xs font-medium">{product.category.name}</p>
          )}

          {/* Name - serif */}
          <h3 className="text-foreground group-hover:text-primary line-clamp-2 font-serif text-lg transition-colors duration-300">
            {product.name}
          </h3>

          {/* Price */}
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-foreground text-xl font-medium">
              {formatPrice(product.price)}
            </span>
            {hasDiscount && (
              <span className="text-muted-foreground text-sm line-through">
                {formatPrice(product.comparePrice!)}
              </span>
            )}
          </div>

          {/* Add to cart button - appears on hover */}
          <div className="mt-4 h-0 overflow-hidden transition-all duration-300 group-hover:h-12">
            <Button
              variant="secondary"
              className="w-full rounded-full font-medium"
              disabled={isOutOfStock}
            >
              {isOutOfStock ? "Notify Me" : "Add to Cart"}
            </Button>
          </div>
        </div>
      </div>
    </Link>
  );
}

export function OrganicProductGrid({
  products,
  title = "Featured Products",
  showViewAll = true,
}: ProductGridProps) {
  return (
    <section className="py-16 md:py-24">
      <div className="container">
        {/* Header */}
        <div className="mb-12 text-center">
          <div className="mb-4 inline-flex items-center gap-3">
            <Leaf className="text-primary h-5 w-5" />
            <span className="text-muted-foreground text-sm font-medium">Handpicked for You</span>
          </div>
          <h2 className="font-serif text-3xl font-medium tracking-tight sm:text-4xl">{title}</h2>
        </div>

        {/* Product Grid */}
        {products.length > 0 ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {products.map((product) => (
              <OrganicProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="bg-muted/30 rounded-3xl py-16 text-center">
            <Package className="text-muted-foreground/50 mx-auto h-12 w-12" />
            <p className="text-muted-foreground mt-4 font-serif text-lg">Products coming soon</p>
            <Link href="/products">
              <Button variant="secondary" className="mt-6 rounded-full">
                Browse All Products
              </Button>
            </Link>
          </div>
        )}

        {/* View all */}
        {showViewAll && products.length > 0 && (
          <div className="mt-12 text-center">
            <Link href="/products?featured=true">
              <Button variant="outline" className="gap-2 rounded-full px-8">
                View All Products
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
