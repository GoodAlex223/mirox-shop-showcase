"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { useCartStore } from "@/stores/cart.store";
import { trackAddToCart } from "@/lib/analytics";
import { formatPrice } from "@/lib/format";
import { computeBundleTotals } from "@/lib/bundle-utils";
import { rankSizeValues } from "@/lib/product-display";
import { cn } from "@/lib/utils";
import { ProductImage } from "./ProductImage";
import type { BundleCompanion } from "@/types";

interface BoughtTogetherProps {
  current: BundleCompanion;
  companions: BundleCompanion[];
  /** The size selected in the buy panel; companions preselect to it when available. */
  preferredSizeValue: string | null;
}

type SelectionMap = Record<string, string | null>; // productId → variantId

function pickVariantId(product: BundleCompanion, preferred: string | null): string | null {
  if (product.sizeVariants.length === 0) return null; // sizeless product — added product-level
  const inStock = product.sizeVariants.filter((v) => v.stock > 0);
  if (inStock.length === 0) return null; // unfulfillable
  const preferredMatch = preferred ? inStock.find((v) => v.value === preferred) : undefined;
  if (preferredMatch) return preferredMatch.id;
  const rankedValues = rankSizeValues(inStock.map((v) => v.value));
  return inStock.find((v) => v.value === rankedValues[0])?.id ?? null;
}

function deriveSelections(companions: BundleCompanion[], preferred: string | null): SelectionMap {
  return Object.fromEntries(companions.map((c) => [c.id, pickVariantId(c, preferred)]));
}

/** Chips render in canonical S·M·L·XL·XXL order, not raw query order. */
function orderedSizeVariants(product: BundleCompanion) {
  const orderedValues = rankSizeValues(product.sizeVariants.map((v) => v.value));
  return orderedValues
    .map((value) => product.sizeVariants.find((v) => v.value === value))
    .filter((v): v is BundleCompanion["sizeVariants"][number] => v !== undefined);
}

/**
 * "Bought together" (Mirox Product.dc.html): current product + 2 top-selling
 * companions. Deviations from the reference are deliberate and spec-approved
 * (§7): per-companion size chips (fulfillment needs a real variantId per
 * line) and a strikethrough only when constituent comparePrices genuinely
 * exceed the sum — checkout recomputes prices, so no invented bundle discount.
 */
export function BoughtTogether({ current, companions, preferredSizeValue }: BoughtTogetherProps) {
  const t = useTranslations("products");
  const addItem = useCartStore((state) => state.addItem);
  const openCart = useCartStore((state) => state.openCart);

  const [selections, setSelections] = useState<SelectionMap>(() =>
    deriveSelections(companions, preferredSizeValue)
  );

  // Follow the buy panel's size choice: re-derive all companion chips when it
  // changes (predictable over preserving manual edits — deliberate).
  useEffect(() => {
    setSelections(deriveSelections(companions, preferredSizeValue));
  }, [companions, preferredSizeValue]);

  if (companions.length < 2) return null;

  const currentVariant = preferredSizeValue
    ? (current.sizeVariants.find((v) => v.value === preferredSizeValue && v.stock > 0) ?? null)
    : null;
  const currentResolved =
    (current.sizeVariants.length === 0 && current.stock > 0) || currentVariant !== null;

  const lines = [
    {
      product: current,
      variant: currentVariant,
    },
    ...companions.map((c) => ({
      product: c,
      variant: c.sizeVariants.find((v) => v.id === selections[c.id]) ?? null,
    })),
  ];

  const allResolved =
    currentResolved &&
    companions.every(
      (c) => (c.sizeVariants.length === 0 && c.stock > 0) || selections[c.id] !== null
    );

  const totals = computeBundleTotals(
    lines.map(({ product, variant }) => ({
      price: variant?.price ?? product.price,
      comparePrice: product.comparePrice,
    }))
  );

  const handleAddBundle = () => {
    if (!allResolved) return;
    for (const { product, variant } of lines) {
      const price = parseFloat(variant?.price ?? product.price);
      addItem({
        productId: product.id,
        variantId: variant?.id,
        name: product.name,
        price,
        image: product.image?.url,
        maxStock: variant ? variant.stock : product.stock,
        color: product.colorValue ?? undefined,
        size: variant?.value,
      });
      trackAddToCart({
        item_id: product.id,
        item_name: product.name,
        item_category: product.category?.name,
        item_variant: variant?.value,
        price,
        quantity: 1,
      });
    }
    openCart();
  };

  return (
    <div className="bg-card border-border rounded-[20px] border p-6 sm:p-8">
      <h2 className="mb-6 text-[22px] font-extrabold">{t("boughtTogether.title")}</h2>
      {/* <sm: horizontal snap carousel (152px cards, next card peeks to signal
          swipe — gate revision 2026-08-03); sm+: the original 3-up flex row. */}
      <div className="mb-6 flex snap-x snap-mandatory items-start gap-3 overflow-x-auto pb-2 [scrollbar-width:none] sm:snap-none sm:overflow-x-visible sm:pb-0 [&::-webkit-scrollbar]:hidden">
        {lines.map(({ product, variant }, index) => (
          <div key={product.id} className="contents">
            {index > 0 && (
              <Plus className="text-muted-foreground mt-16 h-5 w-5 shrink-0" aria-hidden />
            )}
            <div className="flex w-[152px] shrink-0 snap-start flex-col gap-2.5 sm:w-auto sm:min-w-0 sm:flex-1">
              <div className="border-border relative h-[150px] overflow-hidden rounded-[14px] border">
                <ProductImage
                  src={product.image?.url}
                  alt={product.image?.alt || product.name}
                  sizes="150px"
                />
              </div>
              <div className="truncate text-[13px] font-bold">{product.name}</div>
              <div className="text-[13.5px] font-extrabold">
                {formatPrice(variant?.price ?? product.price)}
              </div>
              {index === 0
                ? variant && (
                    <div className="text-muted-foreground text-xs font-semibold">
                      {t("variant.size")} <span className="text-foreground">{variant.value}</span>
                    </div>
                  )
                : product.sizeVariants.length > 0 && (
                    <div
                      className="flex flex-wrap gap-1"
                      role="group"
                      aria-label={t("variant.sizeGroupAria", { name: product.name })}
                    >
                      {orderedSizeVariants(product).map((v) => {
                        const active = selections[product.id] === v.id;
                        const out = v.stock <= 0;
                        return (
                          <button
                            key={v.id}
                            type="button"
                            disabled={out}
                            onClick={() =>
                              setSelections((prev) => ({ ...prev, [product.id]: v.id }))
                            }
                            className={cn(
                              "min-w-8 rounded-md border px-1.5 py-1 text-[11px] font-bold transition-colors",
                              active
                                ? "border-white bg-white text-black"
                                : "border-border-strong text-foreground hover:border-white",
                              out && "cursor-not-allowed opacity-40"
                            )}
                          >
                            {v.value}
                          </button>
                        );
                      })}
                    </div>
                  )}
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="text-muted-foreground text-[13.5px]">
          {t("boughtTogether.totalLabel")}{" "}
          {totals.showStrike && (
            <span className="line-through">{formatPrice(totals.compareTotal)}</span>
          )}{" "}
          <span
            data-testid="bundle-total"
            className="text-foreground ml-1.5 text-base font-extrabold"
          >
            {formatPrice(totals.total)}
          </span>
        </div>
        <button
          type="button"
          onClick={handleAddBundle}
          disabled={!allResolved}
          className="rounded-[10px] bg-white px-6 py-3.5 text-[13px] font-extrabold tracking-[0.05em] text-black transition-colors hover:bg-[#e5e5e5] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {t("boughtTogether.addBundle")}
        </button>
      </div>
    </div>
  );
}
