export const dynamic = "force-dynamic";
import { Suspense } from "react";
import { CheckCircle2, Package, Mail, ArrowRight, Loader2, Banknote } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import {
  canAccessOrder,
  isValidOrderNumber,
  normalizeOrderNumber,
  orderGrantCookieName,
} from "@/lib/order-access";
import { PurchaseTracker } from "@/components/analytics/PurchaseTracker";
import { formatPrice } from "@/lib/format";
import { getShippingMethodLabel } from "@/lib/shipping";
import { auth } from "@/lib/auth";

interface ConfirmationPageProps {
  searchParams: Promise<{ order?: string | string[] }>;
}

async function OrderConfirmation({ orderNumber }: { orderNumber: string }) {
  // Scoped to the top-level `checkout` namespace (matches checkout/page.tsx)
  // since this page needs both confirmation.* and summary.qty.
  const t = await getTranslations("checkout");
  const tShipping = await getTranslations("shipping");
  const session = await auth();
  const order = await prisma.order.findUnique({
    where: { orderNumber },
    include: {
      items: true,
    },
  });

  // G18 spec §1: owning session or a valid grant cookie, else /track with the
  // number prefilled. Absent and unauthorized redirect identically — this
  // page is not an existence oracle (the former notFound() was one).
  // Next 14: cookies() is synchronous (await-style is Next 15 — G3 lesson).
  const grant = cookies().get(orderGrantCookieName(orderNumber))?.value;
  if (!canAccessOrder(order, session, grant)) {
    redirect(`/track?order=${encodeURIComponent(orderNumber)}`);
  }

  const shippingAddress = order.shippingAddress as {
    name: string;
    company?: string;
    line1: string;
    line2?: string;
    city: string;
    state?: string;
    postalCode?: string;
    country: string;
  };

  return (
    <div className="container py-12">
      <PurchaseTracker
        orderNumber={order.orderNumber}
        total={Number(order.total)}
        tax={Number(order.tax)}
        shippingCost={Number(order.shippingCost)}
        items={order.items.map((item) => ({
          productId: item.productId,
          productName: item.productName,
          unitPrice: Number(item.unitPrice),
          quantity: item.quantity,
          variantInfo: item.variantInfo,
        }))}
      />
      <div className="mx-auto max-w-2xl">
        <div className="text-center">
          <div className="bg-muted mx-auto flex h-16 w-16 items-center justify-center rounded-full">
            <CheckCircle2 className="text-foreground h-10 w-10" />
          </div>
          <h1 className="mt-6 text-3xl font-extrabold">{t("confirmation.title")}</h1>
          <p className="text-muted-foreground mt-2">
            {t("confirmation.emailSentPrefix")}{" "}
            <span className="text-foreground font-medium">{order.email}</span>
          </p>
          <p className="mt-4 text-lg font-bold">
            {t("confirmation.orderNumberLabel")}
            {order.orderNumber}
          </p>
        </div>

        <div className="bg-card border-border mt-8 rounded-[20px] border p-7">
          <h2 className="flex items-center gap-2 text-lg font-extrabold">
            <Package className="h-5 w-5" />
            {t("confirmation.detailsHeading")}
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
                    {t("summary.qty", { count: item.quantity })} ×{" "}
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
              <span className="text-muted-foreground">{t("confirmation.subtotalLabel")}</span>
              <span className="font-bold">{formatPrice(Number(order.subtotal))}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("confirmation.shippingLabel")}</span>
              <span className="font-bold">{formatPrice(Number(order.shippingCost))}</span>
            </div>
            <div className="mt-1 flex justify-between text-base">
              <span className="font-bold">{t("confirmation.totalLabel")}</span>
              <span className="font-extrabold">{formatPrice(Number(order.total))}</span>
            </div>
          </div>

          <div className="border-border mt-6 border-t pt-4">
            <h3 className="mb-2 flex items-center gap-2 font-bold">
              <Banknote className="h-4 w-4" />
              {t("confirmation.paymentLabel")}
            </h3>
            <p className="text-muted-foreground text-sm">
              {order.paymentMethod === "cod"
                ? t("confirmation.paymentCod")
                : t("confirmation.paymentCard")}
            </p>
          </div>

          <div className="border-border mt-6 border-t pt-4">
            <h3 className="mb-2 font-bold">{t("confirmation.addressHeading")}</h3>
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
              <h3 className="mb-2 font-bold">{t("confirmation.methodHeading")}</h3>
              <p className="text-muted-foreground text-sm">
                {/* Locale-aware first: catalog covers current np-* ids in
                    both locales. Legacy/unknown ids (pre-G2 Stripe-era
                    orders) fall back to the locale-unaware source of truth —
                    see the DELIBERATE DUPLICATION note in lib/shipping.ts. */}
                {tShipping.has(order.shippingMethod as never)
                  ? tShipping(order.shippingMethod as never)
                  : getShippingMethodLabel(order.shippingMethod)}
              </p>
            </div>
          )}

          {order.customerNotes && (
            <div className="border-border mt-6 border-t pt-4">
              <h3 className="mb-2 font-bold">{t("confirmation.notesHeading")}</h3>
              <p className="text-muted-foreground text-sm">{order.customerNotes}</p>
            </div>
          )}
        </div>

        <div className="bg-card border-border mt-6 rounded-[20px] border">
          <div className="flex items-center gap-4 p-5">
            <div className="bg-muted flex h-10 w-10 items-center justify-center rounded-full">
              <Mail className="text-foreground h-5 w-5" />
            </div>
            <div className="flex-1">
              <p className="font-bold">{t("confirmation.emailCardTitle")}</p>
              <p className="text-muted-foreground text-sm">
                {t("confirmation.emailCardTextPrefix")} {order.email}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:justify-center">
          <Link
            href="/products"
            className="inline-flex items-center justify-center gap-2 rounded-[10px] bg-white px-7 py-4 text-[13px] font-extrabold tracking-[0.06em] text-black transition-colors hover:bg-[#e5e5e5]"
          >
            {t("confirmation.continueShopping")}
            <ArrowRight className="h-4 w-4" />
          </Link>
          {session?.user && (
            <Link
              href="/account/orders"
              className="border-border-strong hover:border-muted-foreground inline-flex items-center justify-center rounded-[10px] border px-7 py-4 text-[13px] font-bold transition-colors"
            >
              {t("confirmation.viewOrders")}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

// Non-async — useTranslations, not getTranslations (binding constraint; also
// matches the Task 4 HomePage precedent: getTranslations throws when a test
// renders these fallback trees directly outside the RSC module graph).
function LoadingConfirmation() {
  const t = useTranslations("checkout");
  return (
    <div className="container flex min-h-[60vh] items-center justify-center py-12">
      <div className="text-center">
        <Loader2 className="text-muted-foreground mx-auto h-8 w-8 animate-spin" />
        <p className="text-muted-foreground mt-4">{t("confirmation.loading")}</p>
      </div>
    </div>
  );
}

function NoOrderNumber() {
  const t = useTranslations("checkout");
  return (
    <div className="container py-12">
      <div className="mx-auto max-w-md text-center">
        <h1 className="text-2xl font-extrabold">{t("confirmation.notFoundTitle")}</h1>
        <p className="text-muted-foreground mt-2">{t("confirmation.notFoundText")}</p>
        <Link
          href="/products"
          className="mt-6 inline-block rounded-[10px] bg-white px-7 py-4 text-[13px] font-extrabold tracking-[0.06em] text-black transition-colors hover:bg-[#e5e5e5]"
        >
          {t("confirmation.continueShopping")}
        </Link>
        <p className="mt-4">
          <Link
            href="/track"
            className="text-muted-foreground hover:text-foreground text-sm underline underline-offset-4"
          >
            {t("confirmation.trackLink")}
          </Link>
        </p>
      </div>
    </div>
  );
}

export default async function ConfirmationPage({ searchParams }: ConfirmationPageProps) {
  const params = await searchParams;
  // The gate runs before the number reaches a cookie name, a query or a
  // redirect (spec §1). A malformed value is "no order", not a 404 — and
  // `?order=a&order=b` makes params.order an array, which is also "no order"
  // rather than a normalizeOrderNumber() crash.
  const orderNumber = typeof params.order === "string" ? normalizeOrderNumber(params.order) : "";

  if (!orderNumber || !isValidOrderNumber(orderNumber)) {
    return <NoOrderNumber />;
  }

  return (
    <Suspense fallback={<LoadingConfirmation />}>
      <OrderConfirmation orderNumber={orderNumber} />
    </Suspense>
  );
}
