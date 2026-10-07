"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useCartStore } from "@/stores/cart.store";
import { trackAddToCart } from "@/lib/analytics";
import { formatPrice } from "@/lib/format";
import { IMAGE_SIZES } from "@/lib/image-utils";
import { cn } from "@/lib/utils";
import { ProductImage } from "./ProductImage";
import { SIZE_ORDER, COLOR_SWATCH_CLASSES } from "@/lib/product-display";
import { VARIANT_NAMES } from "@/lib/variant-names";

/** Dialog carousel autoplay tick, milliseconds (R2) — slower than the card's
 *  since the dialog is a deliberate, focused view rather than a hover peek. */
const CAROUSEL_INTERVAL_MS = 2000;

export interface QuickViewProduct {
  id: string;
  name: string;
  slug: string;
  price: string;
  comparePrice: string | null;
  stock: number;
  category?: { name: string; slug: string };
  images: { url: string; alt: string | null }[];
  variants: { id: string; name: string; value: string; stock: number; price: string | null }[];
}

interface QuickViewDialogProps {
  product: QuickViewProduct | null;
  focusSizes: boolean;
  onOpenChange: (open: boolean) => void;
}

export function QuickViewDialog({ product, focusSizes, onOpenChange }: QuickViewDialogProps) {
  const t = useTranslations("products");
  const [selectedSizeId, setSelectedSizeId] = useState<string | null>(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isCarouselPaused, setIsCarouselPaused] = useState(false);
  const sizeGroupRef = useRef<HTMLDivElement>(null);
  const addItem = useCartStore((state) => state.addItem);
  const openCart = useCartStore((state) => state.openCart);

  // Reset the size selection (and carousel position/pause state) whenever a
  // different product opens. Adjusting state during render (rather than in a
  // useEffect) avoids the extra commit-then-recommit cascade React flags for
  // effect-based resets.
  //
  // isCarouselPaused reset (final-review Fix 2): without this, closing the
  // dialog while the pointer sits over an arrow (which sets isCarouselPaused
  // via onMouseEnter) leaves it `true` forever — the mouseleave that would
  // normally clear it never fires because the button unmounts with the
  // dialog first. The next product to open would then never auto-advance.
  const [lastProductId, setLastProductId] = useState<string | null>(product?.id ?? null);
  if ((product?.id ?? null) !== lastProductId) {
    setLastProductId(product?.id ?? null);
    setSelectedSizeId(null);
    setActiveImageIndex(0);
    setIsCarouselPaused(false);
  }

  const images = product?.images ?? [];
  const hasMultipleImages = images.length > 1;

  // Auto-advance while the dialog is open (a product is set) for a genuine
  // multi-image product; hovering either arrow pauses it. Also bails under
  // prefers-reduced-motion (final-review Fix 5), checked lazily right here
  // rather than stored in state — read once per effect run is enough since
  // manual arrow clicks keep working regardless. Fails open (autoplay runs)
  // when matchMedia isn't available at all (SSR / this repo's jsdom test
  // environment), matching ProductCard's same gate.
  useEffect(() => {
    if (!product || !hasMultipleImages || isCarouselPaused) return;
    if (
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }
    const id = setInterval(() => {
      setActiveImageIndex((i) => (i + 1) % images.length);
    }, CAROUSEL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [product, hasMultipleImages, isCarouselPaused, images.length]);

  const stepImage = (delta: number) => {
    setActiveImageIndex((i) => (i + delta + images.length) % images.length);
  };

  const sizes = useMemo(() => {
    const sizeVariants = product?.variants.filter((v) => v.name === VARIANT_NAMES.size) ?? [];
    const uniqueValues = Array.from(new Set(sizeVariants.map((v) => v.value)));
    const ranked = SIZE_ORDER.filter((s) => uniqueValues.includes(s));
    const extras = uniqueValues.filter((v) => !(SIZE_ORDER as readonly string[]).includes(v));
    const order = [...ranked, ...extras];
    return order
      .map((value) => sizeVariants.find((v) => v.value === value))
      .filter((v): v is NonNullable<typeof v> => Boolean(v));
  }, [product]);

  const colorValues = useMemo(
    () =>
      Array.from(
        new Set(
          product?.variants.filter((v) => v.name === VARIANT_NAMES.color).map((v) => v.value) ?? []
        )
      ).filter((value) => value in COLOR_SWATCH_CLASSES),
    [product]
  );

  useEffect(() => {
    if (product && focusSizes && sizeGroupRef.current) {
      sizeGroupRef.current.focus();
    }
  }, [product, focusSizes]);

  if (!product) {
    return <Dialog open={false} onOpenChange={onOpenChange} />;
  }

  const selectedSize = sizes.find((v) => v.id === selectedSizeId) ?? null;
  const basePrice = parseFloat(product.price);
  const comparePrice = product.comparePrice ? parseFloat(product.comparePrice) : null;
  const displayPrice = selectedSize?.price ? parseFloat(selectedSize.price) : basePrice;

  const handleAddToCart = () => {
    const price = selectedSize?.price ? parseFloat(selectedSize.price) : parseFloat(product.price);
    const color = product.variants.find((v) => v.name === VARIANT_NAMES.color)?.value;

    addItem({
      productId: product.id,
      variantId: selectedSize?.id,
      name: product.name,
      price,
      image: product.images[0]?.url,
      maxStock: selectedSize ? selectedSize.stock : product.stock,
      color,
      size: selectedSize?.value,
    });
    trackAddToCart({
      item_id: product.id,
      item_name: product.name,
      item_category: product.category?.name,
      item_variant: selectedSize?.value,
      price,
      quantity: 1,
    });
    openCart();
    onOpenChange(false);
  };

  return (
    <Dialog open={product !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogTitle>{product.name}</DialogTitle>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="bg-muted relative aspect-square overflow-hidden rounded-md">
            {images.length > 0 ? (
              images.map((image, index) => (
                <div
                  key={`${image.url}-${index}`}
                  className={cn(
                    "absolute inset-0 transition-opacity duration-300",
                    index === activeImageIndex ? "opacity-100" : "opacity-0"
                  )}
                >
                  <ProductImage
                    src={image.url}
                    alt={image.alt || product.name}
                    sizes={IMAGE_SIZES.productDetail}
                  />
                </div>
              ))
            ) : (
              <ProductImage src={undefined} alt={product.name} sizes={IMAGE_SIZES.productDetail} />
            )}

            {hasMultipleImages && (
              <>
                <button
                  type="button"
                  aria-label={t("quickView.prevPhoto")}
                  onClick={() => stepImage(-1)}
                  onMouseEnter={() => setIsCarouselPaused(true)}
                  onMouseLeave={() => setIsCarouselPaused(false)}
                  className="absolute top-1/2 left-2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-white/40 bg-black/70 text-white hover:border-white"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  aria-label={t("quickView.nextPhoto")}
                  onClick={() => stepImage(1)}
                  onMouseEnter={() => setIsCarouselPaused(true)}
                  onMouseLeave={() => setIsCarouselPaused(false)}
                  className="absolute top-1/2 right-2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-white/40 bg-black/70 text-white hover:border-white"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </>
            )}
          </div>

          <div className="flex flex-col gap-3">
            {product.category && (
              <p className="text-muted-foreground text-xs">{product.category.name}</p>
            )}

            <div className="flex items-center gap-2">
              <span className="text-lg font-bold">{formatPrice(displayPrice)}</span>
              {comparePrice && comparePrice > displayPrice && (
                <span className="text-muted-foreground text-sm line-through">
                  {formatPrice(comparePrice)}
                </span>
              )}
            </div>

            {colorValues.length > 0 && (
              <div className="flex gap-1.5">
                {colorValues.map((value) => (
                  <span
                    key={value}
                    role="img"
                    aria-label={t("variant.colorAria", { value })}
                    title={value}
                    className={cn("h-4 w-4 rounded-full border", COLOR_SWATCH_CLASSES[value])}
                  />
                ))}
              </div>
            )}

            {sizes.length > 0 && (
              <div ref={sizeGroupRef} tabIndex={-1} className="outline-none">
                <p className="mb-1.5 text-xs font-semibold">{t("variant.sizeLabel")}</p>
                <div className="flex flex-wrap gap-2">
                  {sizes.map((variant) => {
                    const isActive = variant.id === selectedSizeId;
                    const isOutOfStock = variant.stock <= 0;
                    return (
                      <button
                        key={variant.id}
                        type="button"
                        disabled={isOutOfStock}
                        onClick={() => setSelectedSizeId(variant.id)}
                        className={cn(
                          "min-w-[52px] rounded-[7px] border border-[#333] px-3 py-2 text-[12.5px] font-bold disabled:cursor-not-allowed disabled:opacity-40",
                          isActive && "bg-white text-black"
                        )}
                      >
                        {variant.value}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <button
              type="button"
              disabled={sizes.length > 0 && !selectedSize}
              onClick={handleAddToCart}
              className="mt-2 rounded-[10px] bg-white px-4 py-3 text-[13px] font-extrabold text-black hover:bg-[#e5e5e5] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {t("quickView.addToCart")}
            </button>

            <Link
              href={`/products/${product.slug}`}
              className="text-muted-foreground mt-1 text-sm underline-offset-4 hover:underline"
            >
              {t("quickView.viewDetails")}
            </Link>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
