"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ShoppingBag, X, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useCartStore } from "@/stores/cart.store";
import { formatPrice } from "@/lib/format";
import { trackViewCart } from "@/lib/analytics";

export function CartDrawer() {
  const router = useRouter();
  const t = useTranslations("cart");
  const { items, isOpen, closeCart, updateQuantity, removeItem, getTotalPrice, getTotalItems } =
    useCartStore();
  const [mounted, setMounted] = useState(false);

  // Handle hydration mismatch - intentional setState in effect for client hydration
  useEffect(() => {
    setMounted(true); // eslint-disable-line react-hooks/set-state-in-effect
  }, []);

  // GA4: Track cart view when drawer opens
  useEffect(() => {
    if (isOpen && items.length > 0) {
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
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const subtotal = getTotalPrice();
  const totalItems = getTotalItems();

  const handleCheckout = () => {
    closeCart();
    router.push("/checkout");
  };

  const handleViewCart = () => {
    closeCart();
    router.push("/cart");
  };

  if (!mounted) return null;

  return (
    <Sheet open={isOpen} onOpenChange={closeCart}>
      <SheetContent className="flex w-full flex-col sm:max-w-md">
        <SheetHeader className="space-y-0">
          <SheetTitle className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5" />
            {t("drawer.title")} ({totalItems})
          </SheetTitle>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center">
            <div className="border-border mx-1 my-auto rounded-2xl border border-dashed p-10 text-center">
              <p className="text-foreground text-base font-bold">{t("empty.title")}</p>
              <Link
                href="/products"
                onClick={closeCart}
                className="text-foreground mt-2 inline-block text-sm font-bold underline underline-offset-4"
              >
                {t("empty.cta")}
              </Link>
            </div>
          </div>
        ) : (
          <>
            <ScrollArea className="flex-1 px-6">
              <div className="space-y-4 py-4">
                {items.map((item) => {
                  const variantLine = [
                    item.color && `${t("variant.color")} ${item.color}`,
                    item.size && `${t("variant.size")} ${item.size}`,
                  ]
                    .filter(Boolean)
                    .join(" · ");
                  return (
                    <div key={`${item.productId}-${item.variantId || ""}`} className="flex gap-4">
                      <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl">
                        {item.image ? (
                          <Image
                            src={item.image}
                            alt={item.name}
                            width={80}
                            height={80}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="bg-muted flex h-full w-full items-center justify-center">
                            <ShoppingBag className="text-muted-foreground h-8 w-8" />
                          </div>
                        )}
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h4 className="line-clamp-2 text-sm font-bold">{item.name}</h4>
                            {variantLine && (
                              <p className="text-muted-foreground mt-0.5 text-xs font-semibold">
                                {variantLine}
                              </p>
                            )}
                            <p className="text-muted-foreground mt-0.5 text-sm">
                              {formatPrice(item.price)}
                            </p>
                          </div>
                          <button
                            type="button"
                            aria-label={t("remove")}
                            className="text-muted-foreground hover:text-foreground -mr-2 h-8 w-8 shrink-0 transition-colors"
                            onClick={() => removeItem(item.productId, item.variantId)}
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                        <div className="mt-auto flex items-center justify-between">
                          <div className="border-border-strong flex items-center overflow-hidden rounded-[10px] border">
                            <button
                              type="button"
                              aria-label={t("quantity.decrease")}
                              className="text-foreground hover:bg-muted h-7 w-7 text-sm transition-colors"
                              onClick={() =>
                                updateQuantity(item.productId, item.quantity - 1, item.variantId)
                              }
                            >
                              −
                            </button>
                            <span className="w-7 text-center text-xs font-bold">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              aria-label={t("quantity.increase")}
                              className="text-foreground hover:bg-muted h-7 w-7 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                              onClick={() =>
                                updateQuantity(item.productId, item.quantity + 1, item.variantId)
                              }
                              disabled={item.quantity >= item.maxStock}
                            >
                              +
                            </button>
                          </div>
                          <p className="text-sm font-bold">
                            {formatPrice(item.price * item.quantity)}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>

            <div className="space-y-4 px-6 pt-4 pb-6">
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-muted-foreground shrink-0">
                    {t("summary.itemsLabel")} ({totalItems})
                  </span>
                  <span className="font-bold">{formatPrice(subtotal)}</span>
                </div>
                <div className="flex items-start justify-between gap-3 text-sm">
                  <span className="text-muted-foreground shrink-0">
                    {t("summary.shippingLabel")}
                  </span>
                  <span className="text-muted-foreground min-w-0 text-right text-[13px]">
                    {t("summary.shippingValue")}
                  </span>
                </div>
                <Separator />
                <div className="flex items-center justify-between gap-3 font-bold">
                  <span>{t("summary.totalLabel")}</span>
                  <span>{formatPrice(subtotal)}</span>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={handleCheckout}
                  className="flex w-full items-center justify-center rounded-[10px] bg-white p-4 text-[13.5px] font-extrabold tracking-[0.06em] text-black transition-colors hover:bg-[#e5e5e5]"
                >
                  {t("summary.checkoutCta")}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </button>
                <Button variant="outline" onClick={handleViewCart} className="w-full">
                  {t("drawer.viewCart")}
                </Button>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
