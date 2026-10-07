"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams, useRouter } from "next/navigation";
import { Package, ChevronLeft, ChevronRight, Eye, ShoppingBag } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { getOrderStatusStyle } from "@/lib/order-status";
import { formatPrice } from "@/lib/format";

interface OrderItem {
  id: string;
  productName: string;
  variantInfo?: string;
  quantity: number;
  unitPrice: string;
  totalPrice: string;
  image: string | null;
}

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  total: string;
  createdAt: string;
  items: OrderItem[];
}

interface OrdersResponse {
  orders: Order[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

const ORDER_FILTER_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
] as const;

function OrdersPageContent() {
  const t = useTranslations("account");
  const format = useFormatter();
  // Unknown enum values degrade to the raw status, never the key path
  // (parity with main's `?? status`); drift net in i18n-catalogs.test.ts.
  const statusLabel = (s: string) =>
    t.has(`orderStatus.${s}` as never) ? t(`orderStatus.${s}` as never) : s;
  const router = useRouter();
  const searchParams = useSearchParams();
  const [orders, setOrders] = useState<Order[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState(searchParams?.get("status") || "all");

  useEffect(() => {
    const fetchOrders = async () => {
      setIsLoading(true);
      try {
        const page = searchParams?.get("page") || "1";
        const status = searchParams?.get("status") || "all";
        const params = new URLSearchParams({ page, status });

        const response = await fetch(`/api/orders?${params}`);
        if (response.ok) {
          const data: OrdersResponse = await response.json();
          setOrders(data.orders);
          setPagination(data.pagination);
        }
      } catch (error) {
        console.error("Failed to fetch orders:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchOrders();
  }, [searchParams]);

  const handleStatusChange = (value: string) => {
    setStatusFilter(value);
    const params = new URLSearchParams(searchParams?.toString());
    if (value === "all") {
      params.delete("status");
    } else {
      params.set("status", value);
    }
    params.set("page", "1");
    router.push(`/account/orders?${params.toString()}`);
  };

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams?.toString());
    params.set("page", newPage.toString());
    router.push(`/account/orders?${params.toString()}`);
  };

  const formatDate = (dateString: string) => {
    return format.dateTime(new Date(dateString), {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">{t("orders.title")}</h2>
          <Skeleton className="h-10 w-40" />
        </div>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-semibold">{t("orders.title")}</h2>
        <Select value={statusFilter} onValueChange={handleStatusChange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={t("orders.filter.placeholder")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("orders.filter.all")}</SelectItem>
            {ORDER_FILTER_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {statusLabel(s)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {orders.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ShoppingBag className="text-muted-foreground h-16 w-16" />
            <h3 className="mt-4 text-lg font-medium">{t("orders.empty.title")}</h3>
            <p className="text-muted-foreground mt-2 text-center text-sm">
              {t("orders.empty.description")}
            </p>
            <Button className="mt-6" asChild>
              <Link href="/products">{t("orders.empty.cta")}</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="space-y-4">
            {orders.map((order) => (
              <Card key={order.id} className="overflow-hidden">
                <CardContent className="p-0">
                  {/* Order Header */}
                  <div className="bg-muted/50 flex flex-wrap items-center justify-between gap-4 border-b p-4">
                    <div className="flex flex-wrap items-center gap-4">
                      <div>
                        <p className="text-muted-foreground text-sm">{t("orders.card.placed")}</p>
                        <p className="font-medium">{formatDate(order.createdAt)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-sm">{t("orders.card.total")}</p>
                        <p className="font-medium">{formatPrice(order.total)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-sm">{t("orders.card.number")}</p>
                        <p className="font-medium">{order.orderNumber}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <Badge variant="secondary" className={getOrderStatusStyle(order.status)}>
                        {statusLabel(order.status)}
                      </Badge>
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/account/orders/${order.id}`}>
                          <Eye className="mr-2 h-4 w-4" />
                          {t("orders.card.details")}
                        </Link>
                      </Button>
                    </div>
                  </div>

                  {/* Order Items Preview */}
                  <div className="p-4">
                    <div className="flex flex-wrap gap-4">
                      {order.items.slice(0, 4).map((item) => (
                        <div key={item.id} className="flex items-center gap-3">
                          {item.image ? (
                            <Image
                              src={item.image}
                              alt={item.productName}
                              width={64}
                              height={64}
                              className="h-16 w-16 rounded-md object-cover"
                            />
                          ) : (
                            <div className="bg-muted flex h-16 w-16 items-center justify-center rounded-md">
                              <Package className="text-muted-foreground h-6 w-6" />
                            </div>
                          )}
                          <div>
                            <p className="line-clamp-1 text-sm font-medium">{item.productName}</p>
                            <p className="text-muted-foreground text-sm">
                              {t("orders.card.qty", { count: item.quantity })}
                            </p>
                          </div>
                        </div>
                      ))}
                      {order.items.length > 4 && (
                        <div className="flex items-center">
                          <span className="text-muted-foreground text-sm">
                            {t("orders.card.more", { count: order.items.length - 4 })}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page <= 1}
              >
                <ChevronLeft className="h-4 w-4" />
                {t("orders.pagination.prev")}
              </Button>
              <span className="text-muted-foreground text-sm">
                {t("orders.pagination.pageOf", {
                  page: pagination.page,
                  total: pagination.totalPages,
                })}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages}
              >
                {t("orders.pagination.next")}
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Non-async — useTranslations, not getTranslations (binding constraint; also
// matches the Task 4 HomePage precedent for Suspense-fallback siblings).
function OrdersPageLoading() {
  const t = useTranslations("account");
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">{t("orders.title")}</h2>
        <Skeleton className="h-10 w-40" />
      </div>
      {[1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-32" />
      ))}
    </div>
  );
}

export default function OrdersPage() {
  return (
    <Suspense fallback={<OrdersPageLoading />}>
      <OrdersPageContent />
    </Suspense>
  );
}
