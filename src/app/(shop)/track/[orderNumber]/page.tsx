export const dynamic = "force-dynamic";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { ArrowRight, Banknote, Package, Truck } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatPrice } from "@/lib/format";
import { getShippingMethodLabel } from "@/lib/shipping";
import { getOrderStatusStyle } from "@/lib/order-status";
import {
  canAccessOrder,
  isValidOrderNumber,
  normalizeOrderNumber,
  orderGrantCookieName,
} from "@/lib/order-access";
import { Badge } from "@/components/ui/badge";

interface TrackOrderPageProps {
  params: Promise<{ orderNumber: string }>;
}

// Guest order status (G18 spec §4). Same authorization rule as the
// confirmation page; absent and unauthorized redirect identically to the
// form (no existence oracle). No PurchaseTracker here — the confirmation
// page fires the GA4 purchase once, this page may be visited many times.
export default async function TrackOrderPage({ params }: TrackOrderPageProps) {
  const { orderNumber: raw } = await params;
  const orderNumber = normalizeOrderNumber(raw);
  if (!isValidOrderNumber(orderNumber)) notFound();

  const [session, order] = await Promise.all([
    auth(),
    prisma.order.findUnique({ where: { orderNumber }, include: { items: true } }),
  ]);
  // Next 14: cookies() is synchronous (await-style is Next 15 — G3 lesson).
  const grant = cookies().get(orderGrantCookieName(orderNumber))?.value;
  if (!canAccessOrder(order, session, grant)) {
    redirect(`/track?order=${encodeURIComponent(orderNumber)}`);
  }

  const t = await getTranslations("track.status");
  const tCheckout = await getTranslations("checkout");
  const tAccount = await getTranslations("account");
  const tShipping = await getTranslations("shipping");
  const format = await getFormatter();

  const statusLabel = tAccount.has(`orderStatus.${order.status}` as never)
    ? tAccount(`orderStatus.${order.status}` as never)
    : order.status;

  const shippingAddress = order.shippingAddress as {
    name: string;
    company?: string;
    line1: string;
    line2?: string;
    city: string;
    state?: string;
    postalCode?: string;
  };

  return (
    <div className="container py-12">
      <div className="mx-auto max-w-2xl">
        <div className="text-center">
          <p className="text-muted-foreground text-sm">
            {tCheckout("confirmation.orderNumberLabel")}
          </p>
          <h1 className="mt-1 text-3xl font-extrabold">{order.orderNumber}</h1>
          <div className="mt-4 flex flex-col items-center gap-2">
            <span className="sr-only">{t("statusLabel")}: </span>
            <Badge variant="secondary" className={`${getOrderStatusStyle(order.status)} text-sm`}>
              {statusLabel}
            </Badge>
            <p className="text-muted-foreground text-sm">
              {t("dateLabel")}:{" "}
              {format.dateTime(order.createdAt, { year: "numeric", month: "long", day: "numeric" })}
            </p>
          </div>
        </div>

        {order.trackingNumber && (
          <div className="bg-card border-border mt-8 rounded-[20px] border p-5">
            <h2 className="flex items-center gap-2 font-bold">
              <Truck className="h-4 w-4" />
              {t("trackingLabel")}
            </h2>
            <p className="mt-2 font-mono text-sm">{order.trackingNumber}</p>
            {order.trackingUrl && (
              <a
                href={order.trackingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-sm underline underline-offset-4"
              >
                {t("trackingLink")}
                <ArrowRight className="h-3 w-3" />
              </a>
            )}
          </div>
        )}

        <div className="bg-card border-border mt-6 rounded-[20px] border p-7">
          <h2 className="flex items-center gap-2 text-lg font-extrabold">
            <Package className="h-5 w-5" />
            {tCheckout("confirmation.detailsHeading")}
          </h2>

          <div className="mt-6 space-y-4">
            {order.items.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <p className="font-bold">{item.productName}</p>
                  {item.variantInfo && (
                    <p className="text-muted-foreground text-sm">{item.variantInfo}</p>
                  )}
                  <p className="text-muted-foreground text-sm">
                    {tCheckout("summary.qty", { count: item.quantity })} ×{" "}
                    {formatPrice(Number(item.unitPrice))}
                  </p>
                </div>
                <p className="font-bold whitespace-nowrap">
                  {formatPrice(Number(item.totalPrice))}
                </p>
              </div>
            ))}
          </div>

          <div className="border-border mt-6 space-y-2 border-t pt-4 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                {tCheckout("confirmation.subtotalLabel")}
              </span>
              <span className="font-bold">{formatPrice(Number(order.subtotal))}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                {tCheckout("confirmation.shippingLabel")}
              </span>
              <span className="font-bold">{formatPrice(Number(order.shippingCost))}</span>
            </div>
            <div className="mt-1 flex justify-between text-base">
              <span className="font-bold">{tCheckout("confirmation.totalLabel")}</span>
              <span className="font-extrabold">{formatPrice(Number(order.total))}</span>
            </div>
          </div>

          <div className="border-border mt-6 border-t pt-4">
            <h3 className="mb-2 flex items-center gap-2 font-bold">
              <Banknote className="h-4 w-4" />
              {tCheckout("confirmation.paymentLabel")}
            </h3>
            <p className="text-muted-foreground text-sm">
              {order.paymentMethod === "cod"
                ? tCheckout("confirmation.paymentCod")
                : tCheckout("confirmation.paymentCard")}
            </p>
          </div>

          <div className="border-border mt-6 border-t pt-4">
            <h3 className="mb-2 font-bold">{tCheckout("confirmation.addressHeading")}</h3>
            <p className="text-muted-foreground text-sm">
              {shippingAddress.name}
              {shippingAddress.company && (
                <>
                  <br />
                  {shippingAddress.company}
                </>
              )}
              <br />
              {shippingAddress.line1}
              {shippingAddress.line2 && (
                <>
                  <br />
                  {shippingAddress.line2}
                </>
              )}
              <br />
              {shippingAddress.city}
              {shippingAddress.state && `, ${shippingAddress.state}`}
              {shippingAddress.postalCode && ` ${shippingAddress.postalCode}`}
            </p>
          </div>

          {order.shippingMethod && (
            <div className="border-border mt-6 border-t pt-4">
              <h3 className="mb-2 font-bold">{tCheckout("confirmation.methodHeading")}</h3>
              <p className="text-muted-foreground text-sm">
                {tShipping.has(order.shippingMethod as never)
                  ? tShipping(order.shippingMethod as never)
                  : getShippingMethodLabel(order.shippingMethod)}
              </p>
            </div>
          )}

          {order.customerNotes && (
            <div className="border-border mt-6 border-t pt-4">
              <h3 className="mb-2 font-bold">{tCheckout("confirmation.notesHeading")}</h3>
              <p className="text-muted-foreground text-sm">{order.customerNotes}</p>
            </div>
          )}
        </div>

        <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:justify-center">
          <Link
            href="/products"
            className="inline-flex items-center justify-center gap-2 rounded-[10px] bg-white px-7 py-4 text-[13px] font-extrabold tracking-[0.06em] text-black transition-colors hover:bg-[#e5e5e5]"
          >
            {tCheckout("confirmation.continueShopping")}
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/track"
            className="border-border-strong hover:border-muted-foreground inline-flex items-center justify-center rounded-[10px] border px-7 py-4 text-[13px] font-bold transition-colors"
          >
            {t("checkAnother")}
          </Link>
        </div>
      </div>
    </div>
  );
}
