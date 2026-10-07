import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Package, ShoppingCart, Zap } from "lucide-react";
import { formatPrice } from "@/lib/format";
import type { ProductGridProps, ShowcaseProduct } from "../types";

function BoldProductCard({ product }: { product: ShowcaseProduct }) {
  const hasDiscount =
    product.comparePrice && parseFloat(product.comparePrice) > parseFloat(product.price);
  const discountPercent = hasDiscount
    ? Math.round((1 - parseFloat(product.price) / parseFloat(product.comparePrice!)) * 100)
    : 0;
  const isOutOfStock = product.stock === 0;
  const imageUrl = product.images[0]?.url || "/placeholder.svg";

  return (
    <Link href={`/products/${product.slug}`} className="group block">
      <div className="bg-card relative overflow-hidden rounded-2xl shadow-xl transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl">
        {/* Image container */}
        <div className="bg-muted relative aspect-square overflow-hidden">
          <Image
            src={imageUrl}
            alt={product.images[0]?.alt || product.name}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-110"
          />

          {/* Badges - animated reveal */}
          <div className="absolute top-3 left-3 flex flex-col gap-2">
            {hasDiscount && (
              <Badge className="bg-accent text-accent-foreground animate-in slide-in-from-left px-3 py-1 font-bold duration-300">
                <Zap className="mr-1 h-3 w-3" />
                {discountPercent}% OFF
              </Badge>
            )}
            {isOutOfStock && (
              <Badge variant="destructive" className="px-3 py-1 font-bold">
                Sold Out
              </Badge>
            )}
            {product.isFeatured && !hasDiscount && (
              <Badge className="bg-primary px-3 py-1 font-bold">Featured</Badge>
            )}
          </div>

          {/* Quick add button - slides up on hover */}
          <div className="absolute inset-x-0 bottom-0 translate-y-full transition-transform duration-300 group-hover:translate-y-0">
            <Button
              className="bg-primary/95 w-full rounded-none py-6 font-bold backdrop-blur-sm"
              disabled={isOutOfStock}
            >
              <ShoppingCart className="mr-2 h-5 w-5" />
              {isOutOfStock ? "Out of Stock" : "Quick Add"}
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="p-5">
          {/* Category */}
          {product.category && (
            <p className="text-primary mb-2 text-xs font-bold tracking-wider uppercase">
              {product.category.name}
            </p>
          )}

          {/* Name */}
          <h3 className="text-foreground group-hover:text-primary line-clamp-2 text-lg font-bold transition-colors">
            {product.name}
          </h3>

          {/* Price */}
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-foreground text-2xl font-extrabold">
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

export function BoldProductGrid({
  products,
  title = "Featured Products",
  showViewAll = true,
}: ProductGridProps) {
  return (
    <section className="py-20 md:py-28">
      <div className="container">
        {/* Header */}
        <div className="mb-10 flex items-end justify-between">
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl md:text-5xl">
              {title}
            </h2>
            <p className="text-muted-foreground mt-2">Handpicked items just for you</p>
          </div>
          {showViewAll && (
            <Link
              href="/products?featured=true"
              className="text-primary hidden items-center gap-2 font-bold hover:underline sm:flex"
            >
              View All
              <ArrowRight className="h-5 w-5" />
            </Link>
          )}
        </div>

        {/* Product Grid - 4 columns */}
        {products.length > 0 ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {products.map((product) => (
              <BoldProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="bg-muted/50 rounded-2xl py-20 text-center">
            <Package className="text-muted-foreground mx-auto h-16 w-16" />
            <p className="text-muted-foreground mt-4 text-lg font-medium">No products available</p>
            <Link href="/products">
              <Button className="mt-6 font-bold" size="lg">
                Browse All Products
              </Button>
            </Link>
          </div>
        )}

        {/* Mobile view all */}
        {showViewAll && products.length > 0 && (
          <div className="mt-8 text-center sm:hidden">
            <Link href="/products?featured=true">
              <Button variant="outline" className="font-bold">
                View All Products
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
