"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  Package,
  ArrowLeft,
  Truck,
  CheckCircle2,
  Clock,
  XCircle,
  CreditCard,
  MapPin,
} from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { getOrderStatusStyle } from "@/lib/order-status";
import { formatPrice } from "@/lib/format";

interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  variantInfo?: string;
  quantity: number;
  unitPrice: string;
  totalPrice: string;
  image: string | null;
  productSlug: string;
}

interface Order {
  id: string;
  orderNumber: string;
  email: string;
  phone?: string;
  status: string;
  paymentStatus: string;
  paymentMethod?: string;
  subtotal: string;
  shippingCost: string;
  discount: string;
  tax: string;
  total: string;
  shippingAddress: {
    name: string;
    company?: string;
    line1: string;
    line2?: string;
    city: string;
    state?: string;
    postalCode: string;
    country: string;
    phone?: string;
  };
  shippingMethod?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  customerNotes?: string;
  createdAt: string;
  paidAt?: string;
  items: OrderItem[];
}

export default function OrderDetailPage() {
  const t = useTranslations("account");
  const format = useFormatter();
  // Unknown enum values degrade to the raw status, never the key path
  // (parity with main's `?? status`); drift net in i18n-catalogs.test.ts.
  const statusLabel = (s: string) =>
    t.has(`orderStatus.${s}` as never) ? t(`orderStatus.${s}` as never) : s;
  const paymentLabel = (s: string) =>
    t.has(`paymentStatus.${s}` as never) ? t(`paymentStatus.${s}` as never) : s;
  // non-null: the pages-compat types in next-env.d.ts make useParams() nullable; App Router always supplies params
  const { id } = useParams<{ id: string }>()!;
  const router = useRouter();
  const [order, setOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const ORDER_TIMELINE = [
    { status: "PENDING", label: t("orderDetail.timeline.placed"), icon: Clock },
    { status: "CONFIRMED", label: t("orderDetail.timeline.confirmed"), icon: CheckCircle2 },
    { status: "PROCESSING", label: t("orderDetail.timeline.processing"), icon: Package },
    { status: "SHIPPED", label: t("orderDetail.timeline.shipped"), icon: Truck },
    { status: "DELIVERED", label: t("orderDetail.timeline.delivered"), icon: CheckCircle2 },
  ];

  const CANCELLED_TIMELINE = [
    { status: "PENDING", label: t("orderDetail.timeline.placed"), icon: Clock },
    { status: "CANCELLED", label: t("orderDetail.timeline.cancelled"), icon: XCircle },
  ];

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        const response = await fetch(`/api/orders/${id}`);
        if (!response.ok) {
          if (response.status === 404) {
            setError(t("orderDetail.notFound"));
          } else {
            setError(t("orderDetail.loadFailed"));
          }
          return;
        }
        const data = await response.json();
        setOrder(data);
      } catch {
        setError(t("orderDetail.loadFailed"));
      } finally {
        setIsLoading(false);
      }
    };

    fetchOrder();
  }, [id, t]);

  const formatDate = (dateString: string) => {
    return format.dateTime(new Date(dateString), {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusIndex = (status: string) => {
    const timeline =
      status === "CANCELLED" || status === "REFUNDED" ? CANCELLED_TIMELINE : ORDER_TIMELINE;
    return timeline.findIndex((s) => s.status === status);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Skeleton className="h-48" />
            <Skeleton className="h-64" />
          </div>
          <div className="space-y-6">
            <Skeleton className="h-48" />
            <Skeleton className="h-32" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Package className="text-muted-foreground h-16 w-16" />
        <h2 className="mt-4 text-lg font-medium">{error || t("orderDetail.notFound")}</h2>
        <Button className="mt-6" onClick={() => router.push("/account/orders")}>
          {t("orderDetail.backToOrders")}
        </Button>
      </div>
    );
  }

  const timeline =
    order.status === "CANCELLED" || order.status === "REFUNDED"
      ? CANCELLED_TIMELINE
      : ORDER_TIMELINE;
  const currentStatusIndex = getStatusIndex(order.status);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/account/orders">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h2 className="text-xl font-semibold">
              {t("orderDetail.orderTitle", { num: order.orderNumber })}
            </h2>
            <p className="text-muted-foreground text-sm">
              {t("orderDetail.placedOn", { date: formatDate(order.createdAt) })}
            </p>
          </div>
        </div>
        <Badge variant="secondary" className={`${getOrderStatusStyle(order.status)} text-sm`}>
          {statusLabel(order.status)}
        </Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="space-y-6 lg:col-span-2">
          {/* Order Status Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("orderDetail.timeline.title")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative">
                {timeline.map((step, index) => {
                  const isCompleted = index <= currentStatusIndex;
                  const isCurrent = index === currentStatusIndex;
                  const Icon = step.icon;

                  return (
                    <div key={step.status} className="flex gap-4 pb-8 last:pb-0">
                      {/* Timeline Line */}
                      <div className="relative flex flex-col items-center">
                        <div
                          className={`flex h-10 w-10 items-center justify-center rounded-full border-2 ${
                            isCompleted
                              ? step.status === "CANCELLED"
                                ? "border-destructive bg-destructive text-destructive-foreground"
                                : "border-foreground bg-foreground text-background"
                              : "border-muted-foreground/30 bg-background text-muted-foreground"
                          }`}
                        >
                          <Icon className="h-5 w-5" />
                        </div>
                        {index < timeline.length - 1 && (
                          <div
                            className={`absolute top-10 h-full w-0.5 ${
                              index < currentStatusIndex
                                ? "bg-foreground"
                                : "bg-muted-foreground/30"
                            }`}
                          />
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 pt-2">
                        <p className={`font-medium ${isCompleted ? "" : "text-muted-foreground"}`}>
                          {step.label}
                        </p>
                        {isCurrent && order.status === "SHIPPED" && order.trackingNumber && (
                          <div className="mt-2">
                            <p className="text-muted-foreground text-sm">
                              {t("orderDetail.timeline.tracking")} {order.trackingNumber}
                            </p>
                            {order.trackingUrl && (
                              <Button variant="link" size="sm" className="h-auto p-0" asChild>
                                <a
                                  href={order.trackingUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  {t("orderDetail.timeline.trackPackage")}
                                </a>
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Order Items */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {t("orderDetail.items.title", { count: order.items.length })}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {order.items.map((item) => (
                <div key={item.id} className="flex gap-4 border-b pb-4 last:border-0 last:pb-0">
                  <Link href={`/products/${item.productSlug}`}>
                    {item.image ? (
                      <Image
                        src={item.image}
                        alt={item.productName}
                        width={80}
                        height={80}
                        className="h-20 w-20 rounded-md object-cover"
                      />
                    ) : (
                      <div className="bg-muted flex h-20 w-20 items-center justify-center rounded-md">
                        <Package className="text-muted-foreground h-8 w-8" />
                      </div>
                    )}
                  </Link>
                  <div className="flex-1">
                    <Link
                      href={`/products/${item.productSlug}`}
                      className="font-medium hover:underline"
                    >
                      {item.productName}
                    </Link>
                    {item.variantInfo && (
                      <p className="text-muted-foreground text-sm">{item.variantInfo}</p>
                    )}
                    <p className="text-muted-foreground text-sm">
                      {t("orderDetail.items.sku")} {item.productSku}
                    </p>
                    <div className="mt-2 flex items-center justify-between">
                      <p className="text-sm">
                        {formatPrice(item.unitPrice)} × {item.quantity}
                      </p>
                      <p className="font-medium">{formatPrice(item.totalPrice)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Order Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("orderDetail.summary.title")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t("orderDetail.summary.subtotal")}</span>
                <span>{formatPrice(order.subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t("orderDetail.summary.shipping")}</span>
                <span>{formatPrice(order.shippingCost)}</span>
              </div>
              {parseFloat(order.discount) > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t("orderDetail.summary.discount")}</span>
                  <span className="text-foreground">-{formatPrice(order.discount)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t("orderDetail.summary.tax")}</span>
                <span>{formatPrice(order.tax)}</span>
              </div>
              <Separator />
              <div className="flex justify-between font-semibold">
                <span>{t("orderDetail.summary.total")}</span>
                <span>{formatPrice(order.total)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Shipping Address */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <MapPin className="h-4 w-4" />
                {t("orderDetail.address.title")}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              <p className="font-medium">{order.shippingAddress.name}</p>
              {order.shippingAddress.company && <p>{order.shippingAddress.company}</p>}
              <p>{order.shippingAddress.line1}</p>
              {order.shippingAddress.line2 && <p>{order.shippingAddress.line2}</p>}
              <p>
                {order.shippingAddress.city}
                {order.shippingAddress.state && `, ${order.shippingAddress.state}`}{" "}
                {order.shippingAddress.postalCode}
              </p>
              <p>{order.shippingAddress.country}</p>
              {order.shippingAddress.phone && <p className="mt-2">{order.shippingAddress.phone}</p>}
            </CardContent>
          </Card>

          {/* Payment Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CreditCard className="h-4 w-4" />
                {t("orderDetail.payment.title")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("orderDetail.payment.method")}</span>
                {/* methodLabel ternary (source: account.ts pre-trim) preserved
                    verbatim — cod/card map to their labels, any other value
                    (incl. null/undefined) falls back to the card label except
                    a genuinely unknown non-empty method string, which echoes
                    back raw (defensive parity with the pre-migration fn). */}
                <span>
                  {order.paymentMethod === "cod"
                    ? t("orderDetail.payment.methodCod")
                    : order.paymentMethod === "card"
                      ? t("orderDetail.payment.methodCard")
                      : (order.paymentMethod ?? t("orderDetail.payment.methodCard"))}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("orderDetail.payment.status")}</span>
                <Badge
                  variant={order.paymentStatus === "PAID" ? "default" : "secondary"}
                  className="text-xs"
                >
                  {paymentLabel(order.paymentStatus)}
                </Badge>
              </div>
              {order.paidAt && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("orderDetail.payment.paidOn")}</span>
                  <span>{formatDate(order.paidAt)}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Customer Notes */}
          {order.customerNotes && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("orderDetail.notes.title")}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm">{order.customerNotes}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
