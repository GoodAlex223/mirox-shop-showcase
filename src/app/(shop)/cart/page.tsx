"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Trash2, ShoppingBag, AlertCircle, Lock } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useCartStore, CartItem } from "@/stores/cart.store";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/format";
import { trackViewCart } from "@/lib/analytics";

interface StockInfo {
  productId: string;
  variantId?: string;
  currentStock: number;
  isAvailable: boolean;
}

export default function CartPage() {
  const router = useRouter();
  const t = useTranslations("cart");
  const { items, updateQuantity, removeItem, clearCart, getTotalPrice } = useCartStore();
  const [stockInfo, setStockInfo] = useState<Map<string, StockInfo>>(new Map());
  const [isValidating, setIsValidating] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Handle hydration mismatch - intentional setState in effect for client hydration
  useEffect(() => {
    setMounted(true); // eslint-disable-line react-hooks/set-state-in-effect
  }, []);

  // GA4: Track cart page view
  useEffect(() => {
    if (mounted && items.length > 0) {
      trackViewCart(
        items.map((item) => ({
          item_id: item.productId,
          item_name: item.name,
          item_variant: item.size,
          price: item.price,
          quantity: item.quantity,
        })),
        getTotalPrice()
      );
    }
  }, [mounted]); // eslint-disable-line react-hooks/exhaustive-deps

  // Validate stock for all items
  useEffect(() => {
    if (items.length === 0) return;

    const validateStock = async () => {
      setIsValidating(true);
      const newStockInfo = new Map<string, StockInfo>();

      for (const item of items) {
        try {
          // Fetch current product stock
          const response = await fetch(
            `/api/cart/validate?productId=${item.productId}${item.variantId ? `&variantId=${item.variantId}` : ""}`
          );
          if (response.ok) {
            const data = await response.json();
            const key = `${item.productId}-${item.variantId || ""}`;
            newStockInfo.set(key, {
              productId: item.productId,
              variantId: item.variantId,
              currentStock: data.stock,
              isAvailable: data.isAvailable && data.stock >= item.quantity,
            });
          }
        } catch {
          // Stock validation is best-effort; leave the item unflagged on error.
        }
      }

      setStockInfo(newStockInfo);
      setIsValidating(false);
    };

    validateStock();
  }, [items]);

  const getItemKey = (item: CartItem) => `${item.productId}-${item.variantId || ""}`;

  const getItemStockStatus = (item: CartItem) => {
    const info = stockInfo.get(getItemKey(item));
    if (!info) return null;

    if (!info.isAvailable) {
      if (info.currentStock === 0) return { type: "error", message: t("stock.outOfStock") };
      if (info.currentStock < item.quantity)
        return { type: "warning", message: t("stock.onlyN", { count: info.currentStock }) };
      // Deactivated product with stock remaining: validate reports unavailable
      // but neither stock branch fires — without this the line looks fine here
      // while checkout 400s PRODUCT_UNAVAILABLE in a loop (PR #29 r5).
      return { type: "error", message: t("stock.unavailable") };
    }
    return null;
  };

  const hasStockIssues = () => {
    return items.some((item) => {
      const status = getItemStockStatus(item);
      return status !== null;
    });
  };

  const subtotal = getTotalPrice();
  const total = subtotal;
  const totalQuantity = items.reduce((s, i) => s + i.quantity, 0);

  if (!mounted) {
    return <CartPageSkeleton />;
  }

  if (items.length === 0) {
    return (
      <div className="container py-12">
        <h1 className="text-3xl font-extrabold tracking-tight">{t("title")}</h1>
        <div className="border-border mt-8 rounded-2xl border border-dashed p-14 text-center">
          <p className="text-foreground text-base font-bold">{t("empty.title")}</p>
          <Link
            href="/products"
            className="text-foreground mt-2 inline-block text-sm font-bold underline underline-offset-4"
          >
            {t("empty.cta")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-12">
      <h1 className="text-3xl font-extrabold tracking-tight">{t("title")}</h1>
      <p className="text-muted-foreground mt-2 text-sm font-semibold">
        {t("itemsCount", { count: items.length })}
      </p>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(340px,400px)] lg:items-start">
        <div>
          <div className="flex flex-col gap-3.5">
            {items.map((item) => {
              const stockStatus = getItemStockStatus(item);
              const variantLine = [
                item.color && `${t("variant.color")} ${item.color}`,
                item.size && `${t("variant.size")} ${item.size}`,
              ]
                .filter(Boolean)
                .join(" · ");
              return (
                <div
                  key={getItemKey(item)}
                  className="bg-card border-border flex flex-wrap items-center gap-4 rounded-2xl border p-4 sm:gap-5 sm:py-4 sm:pr-6 sm:pl-4"
                >
                  <div className="h-[110px] w-24 shrink-0 overflow-hidden rounded-xl">
                    {item.image ? (
                      <Image
                        src={item.image}
                        alt={item.name}
                        width={96}
                        height={110}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="bg-muted flex h-full w-full items-center justify-center">
                        <ShoppingBag className="text-muted-foreground h-8 w-8" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 basis-40">
                    <h3 className="text-[15.5px] font-bold">{item.name}</h3>
                    {variantLine && (
                      <p className="text-muted-foreground mt-1 text-[12.5px] font-semibold">
                        {variantLine}
                      </p>
                    )}
                    <p className="mt-1 text-[14.5px] font-extrabold">{formatPrice(item.price)}</p>
                    {stockStatus && (
                      <p
                        className={cn(
                          "mt-1 flex items-center gap-1 text-sm",
                          stockStatus.type === "error"
                            ? "text-destructive"
                            : "text-muted-foreground"
                        )}
                      >
                        <AlertCircle className="h-3 w-3" />
                        {stockStatus.message}
                      </p>
                    )}
                  </div>
                  <div className="border-border-strong flex items-center overflow-hidden rounded-[10px] border">
                    <button
                      type="button"
                      aria-label={t("quantity.decrease")}
                      className="text-foreground hover:bg-muted h-9 w-9 text-base transition-colors"
                      onClick={() =>
                        updateQuantity(item.productId, item.quantity - 1, item.variantId)
                      }
                    >
                      −
                    </button>
                    <span className="w-8 text-center text-sm font-bold">{item.quantity}</span>
                    <button
                      type="button"
                      aria-label={t("quantity.increase")}
                      className="text-foreground hover:bg-muted h-9 w-9 text-base transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                      onClick={() =>
                        updateQuantity(item.productId, item.quantity + 1, item.variantId)
                      }
                      disabled={item.quantity >= item.maxStock}
                    >
                      +
                    </button>
                  </div>
                  <p className="w-[90px] text-right text-[15.5px] font-extrabold">
                    {formatPrice(item.price * item.quantity)}
                  </p>
                  <button
                    type="button"
                    aria-label={t("remove")}
                    className="text-muted-foreground hover:text-foreground p-1.5 transition-colors"
                    onClick={() => removeItem(item.productId, item.variantId)}
                  >
                    <Trash2 className="h-[18px] w-[18px]" />
                  </button>
                </div>
              );
            })}
          </div>
          <div className="mt-6 flex items-center justify-between">
            <Link
              href="/products"
              className="text-muted-foreground hover:text-foreground text-sm font-bold transition-colors"
            >
              ← {t("continueShopping")}
            </Link>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-destructive text-sm font-bold transition-colors"
                >
                  {t("clear.action")}
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t("clear.dialogTitle")}</AlertDialogTitle>
                  <AlertDialogDescription>{t("clear.dialogDescription")}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t("clear.cancel")}</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={clearCart}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {t("clear.confirm")}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        <div className="bg-card border-border rounded-[20px] border p-7 lg:sticky lg:top-24">
          <h2 className="text-xl font-extrabold">{t("summary.title")}</h2>
          <div className="mt-5 flex flex-col gap-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                {t("summary.itemsLabel")} ({totalQuantity})
              </span>
              <span className="font-bold">{formatPrice(subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("summary.shippingLabel")}</span>
              <span className="text-muted-foreground text-[13px]">
                {t("summary.shippingValue")}
              </span>
            </div>
          </div>
          <div className="border-border mt-5 flex items-center justify-between border-t pt-4">
            <span className="text-[15px] font-bold">{t("summary.totalLabel")}</span>
            <span className="text-xl font-extrabold">{formatPrice(total)}</span>
          </div>
          {hasStockIssues() && (
            <div className="bg-destructive/10 text-destructive mt-4 rounded-md p-3 text-sm">
              <p className="flex items-center gap-2 font-medium">
                <AlertCircle className="h-4 w-4" />
                {t("summary.stockIssues.title")}
              </p>
              <p className="text-muted-foreground mt-1">{t("summary.stockIssues.description")}</p>
            </div>
          )}
          <button
            type="button"
            className="mt-5 w-full rounded-[10px] bg-white p-4 text-[13.5px] font-extrabold tracking-[0.06em] text-black transition-colors hover:bg-[#e5e5e5] disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => router.push("/checkout")}
            disabled={hasStockIssues() || isValidating}
          >
            {isValidating ? t("summary.validating") : t("summary.checkoutCta")}
          </button>
          <p className="text-muted-foreground mt-3.5 flex items-center justify-center gap-2 text-xs font-semibold">
            <Lock className="h-3.5 w-3.5" />
            {t("summary.securePayment")}
          </p>
        </div>
      </div>
    </div>
  );
}

function CartPageSkeleton() {
  return (
    <div className="container py-12">
      <div className="bg-muted h-9 w-48 animate-pulse rounded" />
      <div className="bg-muted mt-2 h-5 w-32 animate-pulse rounded" />

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(340px,400px)] lg:items-start">
        <div className="flex flex-col gap-3.5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-muted h-[142px] animate-pulse rounded-2xl" />
          ))}
        </div>
        <div className="bg-muted h-[320px] animate-pulse rounded-[20px]" />
      </div>
    </div>
  );
}
