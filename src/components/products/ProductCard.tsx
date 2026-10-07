"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight, ShoppingCart } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { IMAGE_SIZES } from "@/lib/image-utils";
import { formatPrice } from "@/lib/format";
import { getProductBadge, type ProductBadge } from "@/lib/product-badges";
import { COLOR_SWATCH_CLASSES, rankSizeValues } from "@/lib/product-display";
import { VARIANT_NAMES } from "@/lib/variant-names";
import { cn } from "@/lib/utils";
import { ProductImage } from "./ProductImage";

/** CSS-only, per badge key — kept in the component since it's visual, not copy. */
const BADGE_CLASSES: Record<ProductBadge["key"], string> = {
  sale: "bg-secondary border-border-strong text-foreground",
  new: "bg-white text-black border-transparent",
  outOfStock: "bg-secondary text-foreground",
};

/** Card-hover carousel autoplay tick, milliseconds (R2). */
const CAROUSEL_INTERVAL_MS = 1500;

/**
 * Hover-capability + reduced-motion gates for the card's autoplay interval
 * (final-review Fix 1 / Fix 5). Both fail OPEN (behave as before) when
 * `matchMedia` isn't available at all — that's SSR and this repo's jsdom
 * test environment (which has no `matchMedia` stub), not a real browser; a
 * real touch-only browser does implement `matchMedia` and correctly reports
 * `(hover: hover)` as non-matching, so the gate still does its job there.
 */
function isHoverCapable(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return true;
  return window.matchMedia("(hover: hover)").matches;
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

interface ProductVariantOption {
  name: string;
  value: string;
}

interface ProductCardProps {
  product: {
    id: string;
    name: string;
    slug: string;
    shortDesc?: string | null;
    price: string | number;
    comparePrice?: string | number | null;
    stock: number;
    isFeatured?: boolean;
    createdAt?: string | Date;
    category?: { name: string; slug: string };
    images: { url: string; alt?: string | null }[];
    // Optional: category pages, search API results, and other ProductCard
    // callers besides src/lib/product-queries.ts may not supply variants at
    // all — the size row below just doesn't render in that case.
    variants?: ProductVariantOption[];
  };
  showCategory?: boolean;
  /**
   * When provided, a hover overlay renders two quick-action buttons.
   * `focusSizes: true` on "Add to cart" tells the consumer to open the quick
   * view already focused on size selection; `false` on "Quick view"
   * just opens it. Omitted entirely on server-rendered rails (homepage),
   * where there is no client-side quick view to open.
   */
  onQuickView?: (opts: { focusSizes: boolean }) => void;
}

// Compatibility re-export: SIZE_ORDER now lives in @/lib/product-display
// (single source, shared with QuickViewDialog/filter-bar/PDP); kept here so
// existing importers of `SIZE_ORDER` from this module keep working.
export { SIZE_ORDER } from "@/lib/product-display";

/** Dedupes Size-variant values and orders them S · M · L · XL · XXL; returns null when there are none. */
function getSizeLabel(variants: ProductVariantOption[] | undefined): string | null {
  const sizeValues =
    variants?.filter((v) => v.name === VARIANT_NAMES.size).map((v) => v.value) ?? [];
  if (sizeValues.length === 0) return null;
  return rankSizeValues(sizeValues).join(" · ");
}

export function ProductCard({ product, showCategory = true, onQuickView }: ProductCardProps) {
  const t = useTranslations("products");
  const price = typeof product.price === "string" ? parseFloat(product.price) : product.price;
  const comparePrice = product.comparePrice
    ? typeof product.comparePrice === "string"
      ? parseFloat(product.comparePrice)
      : product.comparePrice
    : null;

  const isOutOfStock = product.stock <= 0;
  const sizeLabel = getSizeLabel(product.variants);
  const images = product.images;
  const hasMultipleImages = images.length > 1;

  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isHovering, setIsHovering] = useState(false);
  const [isArrowPaused, setIsArrowPaused] = useState(false);

  // Card-hover mini-carousel (R2): auto-advances through product.images
  // while the pointer rests anywhere on the Card (isHovering is set by the
  // Card root's onMouseEnter/onMouseLeave below, not the image div — see
  // the comment there for why that boundary matters). Arrows/hover overlay
  // are CSS-gated to hover-capable md+ devices (`hidden ...
  // [@media(hover:hover)]:md:flex` below — final-review Fix 1; a ≥768px
  // touch tablet gets invisible-but-tappable overlays via WebKit's emulated
  // :hover rather than a real one), so touch/mobile never shows arrows; this
  // effect additionally never starts unless a real `mouseenter` set
  // isHovering, which touch interactions don't reliably produce (the whole
  // card navigates away on tap before the interval would ever fire) — and,
  // belt-and-suspenders, explicitly bails on non-hover-capable devices and
  // on prefers-reduced-motion (final-review Fix 1 / Fix 5), so a touch tap
  // that does manage to synthesize a mouseenter still can't start it.
  useEffect(() => {
    if (!hasMultipleImages || !isHovering || isArrowPaused) return;
    if (!isHoverCapable() || prefersReducedMotion()) return;
    const id = setInterval(() => {
      setActiveImageIndex((i) => (i + 1) % images.length);
    }, CAROUSEL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [hasMultipleImages, isHovering, isArrowPaused, images.length]);

  const stepImage = (delta: number) => {
    setActiveImageIndex((i) => (i + delta + images.length) % images.length);
  };

  const colorValues = Array.from(
    new Set(
      product.variants?.filter((v) => v.name === VARIANT_NAMES.color).map((v) => v.value) ?? []
    )
  ).filter((value) => value in COLOR_SWATCH_CLASSES);

  // Single badge max — precedence rule lives in getProductBadge (@/lib/product-badges).
  const badge = getProductBadge({
    price,
    comparePrice,
    createdAt: product.createdAt,
    stock: product.stock,
  });
  const badgeLabel = badge
    ? badge.key === "sale"
      ? t("badges.sale", { percent: badge.percent })
      : badge.key === "new"
        ? t("badges.new")
        : t("badges.outOfStock")
    : null;

  return (
    <Card
      className="group hover-lift relative flex h-full flex-col overflow-hidden shadow-[var(--shadow-soft)]"
      data-testid="product-card"
      // Hover tracking lives on the Card root, not the image div (fix
      // round 1): the carousel arrows and quick-action buttons are
      // absolutely-positioned DOM SIBLINGS of the Link, stacked visually
      // over the image but structurally children of this Card. If hover
      // tracking were on the image div alone, moving the cursor from the
      // image onto an overlay button would fire mouseleave on the image div
      // (the button becomes the new hit-test target) and reset the
      // carousel back to image[0] / stop autoplay before the user could
      // ever click an arrow. Anchoring both the mouseenter/mouseleave
      // tracking AND the group-hover CSS that reveals the overlays (see
      // `group` above) to this same Card boundary means moving onto any
      // overlay button — or the text area below the image — never counts
      // as leaving; only actually leaving the Card's rectangle does.
      onMouseEnter={() => hasMultipleImages && setIsHovering(true)}
      onMouseLeave={() => {
        setIsHovering(false);
        setActiveImageIndex(0);
      }}
    >
      {/* Whole card is one link, per the design handoff (its product card is
          a single <a>) — no separate footer CTA, no nested category link
          (nesting an <a> inside this one would be invalid HTML). aria-label
          pins the link's accessible name to just the product name; without
          it, the computed name would be the concatenation of every nested
          text node (category, description, both prices, size row) — a much
          noisier announcement than a screen reader needs for "go to this
          product's page". The quick-action overlay buttons live outside this
          Link as Card siblings — buttons nested inside an <a> are invalid
          HTML. `flex-1` makes the Link (and thus CardContent below) stretch
          to the Card's full h-full height so equal-height grid rows (R1)
          have somewhere to put the extra space; `mt-auto` on the price row
          below is what actually consumes it. */}
      <Link
        href={`/products/${product.slug}`}
        className="flex flex-1 flex-col"
        aria-label={product.name}
      >
        <div className="bg-muted relative aspect-square overflow-hidden">
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
                  sizes={IMAGE_SIZES.productCard}
                />
              </div>
            ))
          ) : (
            <ProductImage src={undefined} alt={product.name} sizes={IMAGE_SIZES.productCard} />
          )}

          {/* Badge */}
          {badge && (
            <div className="pointer-events-none absolute top-2 left-2 flex flex-col gap-1">
              <Badge
                variant="secondary"
                className={cn(
                  "rounded-full px-2.5 py-1 text-[10.5px] font-extrabold",
                  BADGE_CLASSES[badge.key]
                )}
              >
                {badgeLabel}
              </Badge>
            </div>
          )}
        </div>

        <CardContent className="flex flex-1 flex-col p-4">
          {showCategory && product.category && (
            <p className="text-muted-foreground text-xs">{product.category.name}</p>
          )}

          <h3 className="group-hover:text-primary mt-1 line-clamp-2 leading-tight font-medium">
            {product.name}
          </h3>

          {product.shortDesc && (
            <p className="text-muted-foreground mt-1 line-clamp-2 text-sm">{product.shortDesc}</p>
          )}

          {/* mt-auto (not mt-2): pins this price row — and the swatches/size
              rows after it — to the bottom of the card, per R1's equal-height
              spec. On the tallest card in a grid row there's no extra space
              to absorb, so this row sits flush after the description there;
              shorter cards in the same row get the gap pushed down instead. */}
          <div className="mt-auto flex flex-wrap items-center gap-2">
            <span className="text-lg font-bold">{formatPrice(price)}</span>
            {comparePrice && comparePrice > price && (
              <span className="text-muted-foreground text-sm line-through">
                {formatPrice(comparePrice)}
              </span>
            )}
          </div>

          {colorValues.length > 0 && (
            <div className="mt-2 flex gap-1.5">
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

          {sizeLabel && (
            <p className="text-muted-foreground mt-2 text-[11.5px] font-semibold">{sizeLabel}</p>
          )}
        </CardContent>
      </Link>

      {/* Carousel arrows (R2) — Card sibling of the Link for the same reason
          as the quick-action overlay below (buttons can't nest in an <a>).
          Gated on hover-capable devices, not just viewport width: plain
          `md:flex` would also fire on a ≥768px device with no real pointer
          (a touch tablet); `hidden ... [@media(hover:hover)]:md:flex`
          (final-review Fix 1) keeps them out of the layout below md AND on
          any md+ device that can't hover, while a ≥768px touch tablet in
          WebKit's emulated-:hover mode still gets an invisible-but-tappable
          overlay per spec. The opacity/pointer-events pair only lets them
          intercept clicks once group-hover/group-focus-within actually
          reveals them — identical gating to the quick-action buttons, so an
          invisible arrow can never steal a click meant for the card link
          underneath. */}
      {hasMultipleImages && (
        <div className="pointer-events-none absolute inset-x-0 top-0 hidden aspect-square items-center justify-between px-2 opacity-0 transition-opacity duration-200 group-focus-within:opacity-100 group-hover:opacity-100 [@media(hover:hover)]:md:flex">
          <button
            type="button"
            aria-label={t("card.prevPhoto")}
            onClick={(e) => {
              // Same lesson as the quick-action fix: this sits over the
              // card's <a>, and catalog/rail wrappers add their own click
              // handler (GA4 select_item) — a manual arrow step must not
              // navigate the card link or fire that tracking.
              e.preventDefault();
              e.stopPropagation();
              stepImage(-1);
            }}
            onMouseEnter={() => setIsArrowPaused(true)}
            onMouseLeave={() => setIsArrowPaused(false)}
            className="pointer-events-none flex h-7 w-7 items-center justify-center rounded-full border border-white/40 bg-black/70 text-white backdrop-blur-sm group-focus-within:pointer-events-auto group-hover:pointer-events-auto hover:border-white"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label={t("card.nextPhoto")}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              stepImage(1);
            }}
            onMouseEnter={() => setIsArrowPaused(true)}
            onMouseLeave={() => setIsArrowPaused(false)}
            className="pointer-events-none flex h-7 w-7 items-center justify-center rounded-full border border-white/40 bg-black/70 text-white backdrop-blur-sm group-focus-within:pointer-events-auto group-hover:pointer-events-auto hover:border-white"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Quick-action overlay — same hover-capability gating as the carousel
          arrows above (final-review Fix 1): `[@media(hover:hover)]:md:flex`
          instead of plain `md:flex` so a ≥768px touch tablet doesn't get a
          permanently-visible overlay it can never actually hover off of. */}
      {onQuickView && (
        <div className="pointer-events-none absolute inset-x-0 top-0 hidden aspect-square items-end justify-center gap-2 p-3 opacity-0 transition-opacity duration-200 group-focus-within:opacity-100 group-hover:opacity-100 [@media(hover:hover)]:md:flex">
          <button
            type="button"
            onClick={(e) => {
              // Card sits inside catalog/rail wrappers with their own click
              // handlers (e.g. GA4 select_item tracking) — opening quick
              // view isn't a product-page navigation, so it must not bubble.
              e.stopPropagation();
              onQuickView({ focusSizes: false });
            }}
            // pointer-events-none by default, matching the invisible
            // opacity-0 state the containing overlay starts in — only the
            // hover/focus-within state that makes the overlay visible
            // (group-hover/group-focus-within:opacity-100 above) re-enables
            // pointer events. An unconditional pointer-events-auto here
            // would let this invisible button sit on top of the card's
            // <a> and intercept clicks meant for it even when nothing is
            // hovered/focused (reproduced via Playwright: "subtree
            // intercepts pointer events").
            className="border-border-strong pointer-events-none rounded-[10px] border bg-black/80 px-3 py-2 text-[12px] font-bold backdrop-blur-sm group-focus-within:pointer-events-auto group-hover:pointer-events-auto hover:border-white"
          >
            {t("card.quickView")}
          </button>
          {!isOutOfStock && (
            <button
              type="button"
              aria-label={t("card.addToCartAria")}
              onClick={(e) => {
                e.stopPropagation();
                onQuickView({ focusSizes: true });
              }}
              // Cart glyph, not the former text label (R3) — the exact icon
              // Header.tsx uses top-right. aria-label keeps the accessible
              // name identical to before (t("card.addToCartAria")'s current
              // Ukrainian value) so the existing test's getByRole locator by
              // that name still finds it.
              className="pointer-events-none flex items-center justify-center rounded-[10px] bg-white px-3 py-2 text-black group-focus-within:pointer-events-auto group-hover:pointer-events-auto hover:bg-[#e5e5e5]"
            >
              <ShoppingCart className="h-4 w-4" />
            </button>
          )}
        </div>
      )}
    </Card>
  );
}
