"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Check, Package, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ProductGallery,
  SizePicker,
  BoughtTogether,
  RecentlyViewed,
  ProductCard,
  SocialShareButtons,
} from "@/components/products";
import { ReviewSection, StarRating } from "@/components/reviews";
import { useCartStore } from "@/stores/cart.store";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/format";
import { VARIANT_NAMES } from "@/lib/variant-names";
import { COLOR_SWATCH_CLASSES, SIZE_ORDER, rankSizeValues } from "@/lib/product-display";
import { trackViewItem, trackAddToCart } from "@/lib/analytics";
import type { ReviewWithUser, RatingDistribution, StyleSibling, BundleCompanion } from "@/types";

interface ProductImageData {
  id: string;
  url: string;
  alt: string | null;
}

interface ProductVariant {
  id: string;
  name: string;
  value: string;
  sku: string;
  price: string;
  stock: number;
  options: Record<string, string>;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  shortDesc: string | null;
  metaTitle?: string | null;
  metaDesc?: string | null;
  price: string;
  comparePrice: string | null;
  stock: number;
  sku: string;
  isFeatured: boolean;
  styleGroup?: string | null;
  colorValue: string | null;
  styleSiblings: StyleSibling[];
  companions: BundleCompanion[];
  category: { id: string; name: string; slug: string };
  images: ProductImageData[];
  variants: ProductVariant[];
  relatedProducts: {
    id: string;
    name: string;
    slug: string;
    shortDesc: string | null;
    price: string;
    comparePrice: string | null;
    stock: number;
    isFeatured: boolean;
    category: { name: string; slug: string };
    images: { url: string; alt: string | null }[];
  }[];
  reviews: ReviewWithUser[];
  averageRating: number;
  totalReviews: number;
  ratingDistribution: RatingDistribution[];
}

const LOW_STOCK_THRESHOLD = 5;

export function ProductDetailClient({ product }: { product: Product }) {
  const t = useTranslations("products");
  const router = useRouter();
  const { addItem } = useCartStore();

  // Sizes: the one real cart dimension (spec §1 constraint 2). Ranked S→XXL;
  // first in-stock preselected.
  const sizes = useMemo(() => {
    const sizeVariants = product.variants.filter((v) => v.name === VARIANT_NAMES.size);
    const ranked = rankSizeValues(sizeVariants.map((v) => v.value));
    return ranked
      .map((value) => sizeVariants.find((v) => v.value === value))
      .filter((v): v is ProductVariant => Boolean(v));
  }, [product.variants]);

  // The size picker only makes sense for products carrying real S–XXL sizes;
  // one-size products (e.g. caps) have a Size variant outside SIZE_ORDER.
  const showSizePicker = sizes.some((v) => (SIZE_ORDER as readonly string[]).includes(v.value));

  const [selectedSizeId, setSelectedSizeId] = useState<string | null>(
    () => sizes.find((v) => v.stock > 0)?.id ?? null
  );
  const selectedSize = sizes.find((v) => v.id === selectedSizeId) ?? null;

  const [addedToCart, setAddedToCart] = useState(false);
  const [isAddingToCart, setIsAddingToCart] = useState(false);

  // E2E hydration signal: interactions (size clicks, add-to-cart) are lost if
  // they land before hydration — tests wait for [data-hydrated="true"].
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []); // eslint-disable-line react-hooks/set-state-in-effect

  const viewTracked = useRef(false);
  useEffect(() => {
    if (viewTracked.current) return;
    viewTracked.current = true;
    trackViewItem({
      item_id: product.id,
      item_name: product.name,
      item_category: product.category.name,
      price: parseFloat(product.price),
      quantity: 1,
    });
  }, [product]);

  const currentPrice = selectedSize ? parseFloat(selectedSize.price) : parseFloat(product.price);
  const comparePrice = product.comparePrice ? parseFloat(product.comparePrice) : null;
  const hasDiscount = comparePrice !== null && comparePrice > currentPrice;

  const currentStock = sizes.length > 0 ? (selectedSize?.stock ?? 0) : product.stock;
  const outOfStock = sizes.length > 0 ? sizes.every((v) => v.stock <= 0) : product.stock <= 0;
  const lowStock = !outOfStock && currentStock > 0 && currentStock <= LOW_STOCK_THRESHOLD;

  const addLine = () => {
    addItem({
      productId: product.id,
      variantId: selectedSize?.id,
      name: product.name,
      price: currentPrice,
      image: product.images[0]?.url,
      maxStock: currentStock,
      color: product.colorValue ?? undefined,
      size: selectedSize?.value,
    });
    trackAddToCart({
      item_id: product.id,
      item_name: product.name,
      item_category: product.category.name,
      item_variant: selectedSize?.value,
      price: currentPrice,
      quantity: 1,
    });
  };

  const handleAddToCart = async () => {
    if (outOfStock || isAddingToCart) return;
    setIsAddingToCart(true);
    await new Promise((resolve) => setTimeout(resolve, 300));
    addLine();
    setIsAddingToCart(false);
    setAddedToCart(true);
    setTimeout(() => setAddedToCart(false), 2000);
  };

  const handleBuyNow = () => {
    if (outOfStock || isAddingToCart) return;
    setIsAddingToCart(true);
    addLine();
    router.push("/checkout");
  };

  // Current colorway + linked siblings (spec §2 #2): the active swatch is this
  // product; sibling swatches navigate to their own PDPs. Legacy prod data may
  // still carry extra Color rows — they render as informational swatches.
  const legacyExtraColors = Array.from(
    new Set(
      product.variants
        .filter((v) => v.name === VARIANT_NAMES.color && v.value !== product.colorValue)
        .map((v) => v.value)
    )
  ).filter((value) => !product.styleSiblings.some((s) => s.colorValue === value));

  const currentAsCompanion: BundleCompanion = {
    id: product.id,
    name: product.name,
    slug: product.slug,
    price: product.price,
    comparePrice: product.comparePrice,
    stock: product.stock,
    image: product.images[0] ? { url: product.images[0].url, alt: product.images[0].alt } : null,
    category: { name: product.category.name },
    colorValue: product.colorValue ?? null,
    sizeVariants: sizes.map((v) => ({ id: v.id, value: v.value, stock: v.stock, price: v.price })),
  };

  return (
    <div className="container py-6 lg:py-8" data-hydrated={hydrated ? "true" : undefined}>
      {/* Breadcrumb — Home / Catalog / {name} (catalog markup precedent) */}
      <nav className="mb-4 text-[12.5px] text-[#737373]">
        <Link href="/" className="hover:text-white">
          {t("breadcrumbHome")}
        </Link>{" "}
        /{" "}
        <Link href="/products" className="hover:text-white">
          {t("catalogName")}
        </Link>{" "}
        / <span className="text-[#a3a3a3]">{product.name}</span>
      </nav>

      {/* Main: gallery | panel */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(340px,420px)] lg:items-start">
        <ProductGallery
          images={product.images.map((i) => ({ url: i.url, alt: i.alt }))}
          productName={product.name}
        />

        <div className="flex flex-col">
          <h1 className="text-[19px] font-extrabold tracking-[-0.02em] lg:text-[30px]">
            {product.name}
          </h1>
          <div className="mt-2.5 flex items-baseline gap-3">
            <span className="text-lg font-extrabold lg:text-[26px]">
              {formatPrice(currentPrice)}
            </span>
            {hasDiscount && (
              <span className="text-muted-foreground text-base line-through">
                {formatPrice(comparePrice)}
              </span>
            )}
          </div>

          {product.totalReviews > 0 && (
            <div className="mt-2.5 flex items-center gap-2">
              <StarRating value={Math.round(product.averageRating)} size="sm" />
              <a href="#reviews" className="text-[13px] text-[#a3a3a3] hover:text-white">
                {t("detail.reviewCount", { count: product.totalReviews })}
              </a>
            </div>
          )}

          {(product.colorValue || product.styleSiblings.length > 0) && (
            <div className="mt-4.5">
              <div className="text-[13.5px] font-semibold text-[#a3a3a3]">
                {t("variant.color")}{" "}
                <span className="text-foreground">{product.colorValue ?? "—"}</span>
              </div>
              <div className="mt-2.5 flex gap-2.5">
                {product.colorValue && (
                  <span
                    aria-label={t("variant.colorAriaSelected", { value: product.colorValue })}
                    className={cn(
                      COLOR_SWATCH_CLASSES[product.colorValue] ?? "bg-muted",
                      "h-9 w-9 rounded-full border-2 border-white"
                    )}
                  />
                )}
                {product.styleSiblings.map((sibling) => (
                  <Link
                    key={sibling.slug}
                    href={`/products/${sibling.slug}`}
                    aria-label={t("variant.colorAriaSibling", {
                      value: sibling.colorValue ?? sibling.name,
                      name: sibling.name,
                    })}
                    title={sibling.name}
                    className={cn(
                      "h-9 w-9 rounded-full border transition-colors hover:border-white",
                      (sibling.colorValue && COLOR_SWATCH_CLASSES[sibling.colorValue]) || "bg-muted"
                    )}
                  />
                ))}
                {legacyExtraColors.map((value) => (
                  <span
                    key={value}
                    aria-label={t("variant.colorAria", { value })}
                    title={value}
                    className={cn(
                      "h-9 w-9 rounded-full border",
                      COLOR_SWATCH_CLASSES[value] ?? "bg-muted"
                    )}
                  />
                ))}
              </div>
            </div>
          )}

          {sizes.length > 0 && (
            <div className="mt-4.5">
              <div className="text-[13.5px] font-semibold text-[#a3a3a3]">{t("variant.size")}</div>
              <div className="mt-2.5 flex flex-wrap gap-2.5">
                {sizes.map((variant) => {
                  const isActive = variant.id === selectedSizeId;
                  const isOut = variant.stock <= 0;
                  return (
                    <button
                      key={variant.id}
                      type="button"
                      aria-pressed={isActive}
                      disabled={isOut}
                      onClick={() => setSelectedSizeId(variant.id)}
                      className={cn(
                        "min-w-[52px] flex-1 rounded-[10px] border px-2 py-3 text-[13.5px] font-bold transition-colors lg:flex-none",
                        isActive
                          ? "border-white bg-white text-black"
                          : "border-border-strong text-foreground hover:border-white",
                        isOut && "cursor-not-allowed opacity-40"
                      )}
                    >
                      {variant.value}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mt-4.5 flex items-center justify-between text-[13.5px]">
            {outOfStock ? (
              <span className="text-muted-foreground font-bold">{t("detail.outOfStock")}</span>
            ) : lowStock ? (
              <span className="font-bold">{t("detail.lowStock", { count: currentStock })}</span>
            ) : (
              <span className="text-available font-bold">{t("detail.inStock")}</span>
            )}
            <span className="text-[#a3a3a3]">{t("detail.shippingNote")}</span>
          </div>

          <div className="mt-3 flex flex-col gap-2.5">
            <button
              type="button"
              onClick={handleAddToCart}
              disabled={outOfStock || isAddingToCart}
              className="rounded-[10px] bg-white p-4 text-sm font-extrabold tracking-[0.06em] text-black transition-colors hover:bg-[#e5e5e5] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {addedToCart ? (
                <span className="inline-flex items-center gap-2">
                  <Check className="h-4 w-4" /> {t("detail.addedToCart")}
                </span>
              ) : (
                t("detail.addToCart")
              )}
            </button>
            <button
              type="button"
              onClick={handleBuyNow}
              disabled={outOfStock || isAddingToCart}
              className="border-border-strong text-foreground rounded-[10px] border p-4 text-sm font-bold tracking-[0.06em] transition-colors hover:border-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t("detail.buyNow")}
            </button>
          </div>

          {/* "Wishlist" and "Open size-chart photo" deliberately absent — spec §7 ledger #2/#3. */}
          <div className="mt-4">
            <SocialShareButtons
              productId={product.id}
              productName={product.name}
              productSlug={product.slug}
              productImage={product.images[0]?.url}
            />
          </div>
        </div>
      </div>

      {/* Size picker + bought together; SizePicker renders only for products with
          real S–XXL sizing — a height/weight recommendation is meaningless for
          one-size items like caps (gate revision, 2026-08-03). */}
      <div
        className={cn(
          "mt-12 grid grid-cols-1 gap-5",
          showSizePicker && "lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]"
        )}
      >
        {showSizePicker && <SizePicker />}
        <BoughtTogether
          current={currentAsCompanion}
          companions={product.companions}
          preferredSizeValue={selectedSize?.value ?? null}
        />
      </div>

      {/* Description — kept for SEO (spec §7 ledger #9) */}
      {product.description && (
        <section aria-label={t("detail.description")} className="mt-16">
          <h2 className="mb-5 text-[28px] font-extrabold tracking-[-0.02em]">
            {t("detail.description")}
          </h2>
          <p className="text-foreground/80 max-w-3xl text-[14.5px] leading-relaxed whitespace-pre-wrap">
            {product.description}
          </p>
        </section>
      )}

      <div id="reviews">
        <ReviewSection
          productId={product.id}
          productSlug={product.slug}
          initialReviews={product.reviews}
          averageRating={product.averageRating}
          totalReviews={product.totalReviews}
          ratingDistribution={product.ratingDistribution}
        />
      </div>

      {product.relatedProducts.length > 0 && (
        <section aria-label={t("detail.relatedProducts")} className="mt-16">
          <h2 className="mb-7 text-[28px] font-extrabold tracking-[-0.02em]">
            {t("detail.relatedProducts")}
          </h2>
          <div className="grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-3 lg:grid-cols-4">
            {product.relatedProducts.map((relatedProduct) => (
              <ProductCard key={relatedProduct.id} product={relatedProduct} />
            ))}
          </div>
        </section>
      )}

      <RecentlyViewed currentProductId={product.id} />
    </div>
  );
}

export function ProductNotFound() {
  const t = useTranslations("products");
  const router = useRouter();
  return (
    <div className="container py-16">
      <div className="flex flex-col items-center justify-center text-center">
        <Package className="text-muted-foreground h-16 w-16" />
        <h1 className="mt-4 text-2xl font-extrabold">{t("detail.notFoundTitle")}</h1>
        <p className="text-muted-foreground mt-2">{t("detail.notFoundDescription")}</p>
        <Button className="mt-6" onClick={() => router.push("/products")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t("detail.backToCatalog")}
        </Button>
      </div>
    </div>
  );
}
