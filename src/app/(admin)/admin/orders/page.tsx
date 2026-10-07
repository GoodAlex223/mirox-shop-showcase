"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Package,
  Search,
  Download,
  Eye,
  ChevronLeft,
  ChevronRight,
  Calendar,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslations } from "next-intl";
import { useDebounce } from "@/hooks/use-debounce";
import { getOrderStatusStyle, getPaymentStatusStyle } from "@/lib/order-status";
import { formatPrice } from "@/lib/format";

interface Order {
  id: string;
  orderNumber: string;
  email: string;
  status: string;
  paymentStatus: string;
  total: string;
  itemCount: number;
  createdAt: string;
  user: {
    id: string;
    name: string | null;
    email: string;
  } | null;
}

interface OrdersResponse {
  data: Order[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

function AdminOrdersContent() {
  const t = useTranslations("admin.orders");
  const tCommon = useTranslations("admin.common");
  const tStatus = useTranslations("account");
  const orderStatusLabel = (s: string) =>
    tStatus.has(`orderStatus.${s}` as never) ? tStatus(`orderStatus.${s}` as never) : s;
  const paymentStatusLabel = (s: string) =>
    tStatus.has(`paymentStatus.${s}` as never) ? tStatus(`paymentStatus.${s}` as never) : s;
  const router = useRouter();
  const searchParams = useSearchParams();
  const [orders, setOrders] = useState<Order[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  // Filters
  const [search, setSearch] = useState(searchParams?.get("search") || "");
  const [status, setStatus] = useState(searchParams?.get("status") || "all");
  const [paymentStatus, setPaymentStatus] = useState(searchParams?.get("paymentStatus") || "all");
  const [dateFrom, setDateFrom] = useState(searchParams?.get("dateFrom") || "");
  const [dateTo, setDateTo] = useState(searchParams?.get("dateTo") || "");

  const debouncedSearch = useDebounce(search, 300);

  const buildQueryString = useCallback(() => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (status !== "all") params.set("status", status);
    if (paymentStatus !== "all") params.set("paymentStatus", paymentStatus);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    params.set("page", searchParams?.get("page") || "1");
    return params.toString();
  }, [debouncedSearch, status, paymentStatus, dateFrom, dateTo, searchParams]);

  useEffect(() => {
    const fetchOrders = async () => {
      setIsLoading(true);
      try {
        const queryString = buildQueryString();
        const response = await fetch(`/api/admin/orders?${queryString}`);
        if (response.ok) {
          const data: OrdersResponse = await response.json();
          setOrders(data.data);
          setPagination(data.pagination);
        }
      } catch (error) {
        console.error("Failed to fetch orders:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchOrders();
  }, [buildQueryString]);

  const updateUrl = useCallback(
    (newParams: Record<string, string>) => {
      const params = new URLSearchParams(searchParams?.toString() || "");
      Object.entries(newParams).forEach(([key, value]) => {
        if (value && value !== "all") {
          params.set(key, value);
        } else {
          params.delete(key);
        }
      });
      params.set("page", "1");
      router.push(`/admin/orders?${params.toString()}`);
    },
    [router, searchParams]
  );

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams?.toString() || "");
    params.set("page", newPage.toString());
    router.push(`/admin/orders?${params.toString()}`);
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const params = new URLSearchParams();
      if (status !== "all") params.set("status", status);
      if (paymentStatus !== "all") params.set("paymentStatus", paymentStatus);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);

      const response = await fetch(`/api/admin/orders/export?${params.toString()}`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `orders-export-${new Date().toISOString().split("T")[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error("Export failed:", error);
    } finally {
      setIsExporting(false);
    }
  };

  const clearFilters = () => {
    setSearch("");
    setStatus("all");
    setPaymentStatus("all");
    setDateFrom("");
    setDateTo("");
    router.push("/admin/orders");
  };

  const hasActiveFilters =
    search || status !== "all" || paymentStatus !== "all" || dateFrom || dateTo;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("uk-UA", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Button onClick={handleExport} disabled={isExporting} variant="outline">
          <Download className="mr-2 h-4 w-4" />
          {isExporting ? t("exporting") : t("export")}
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                <Input
                  placeholder={t("searchPlaceholder")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {/* Status Filter */}
            <Select
              value={status}
              onValueChange={(value) => {
                setStatus(value);
                updateUrl({ status: value });
              }}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder={t("headers.status")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("allStatuses")}</SelectItem>
                <SelectItem value="PENDING">{orderStatusLabel("PENDING")}</SelectItem>
                <SelectItem value="CONFIRMED">{orderStatusLabel("CONFIRMED")}</SelectItem>
                <SelectItem value="PROCESSING">{orderStatusLabel("PROCESSING")}</SelectItem>
                <SelectItem value="SHIPPED">{orderStatusLabel("SHIPPED")}</SelectItem>
                <SelectItem value="DELIVERED">{orderStatusLabel("DELIVERED")}</SelectItem>
                <SelectItem value="CANCELLED">{orderStatusLabel("CANCELLED")}</SelectItem>
              </SelectContent>
            </Select>

            {/* Payment Status Filter */}
            <Select
              value={paymentStatus}
              onValueChange={(value) => {
                setPaymentStatus(value);
                updateUrl({ paymentStatus: value });
              }}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder={t("headers.payment")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("allPaymentStatuses")}</SelectItem>
                <SelectItem value="PENDING">{paymentStatusLabel("PENDING")}</SelectItem>
                <SelectItem value="PAID">{paymentStatusLabel("PAID")}</SelectItem>
                <SelectItem value="FAILED">{paymentStatusLabel("FAILED")}</SelectItem>
                <SelectItem value="REFUNDED">{paymentStatusLabel("REFUNDED")}</SelectItem>
              </SelectContent>
            </Select>

            {/* Date Filters */}
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon">
                  <Calendar className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>{t("dateRange.title")}</SheetTitle>
                </SheetHeader>
                <div className="mt-6 space-y-4">
                  <div>
                    <label className="text-sm font-medium">{t("dateRange.from")}</label>
                    <Input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => {
                        setDateFrom(e.target.value);
                        updateUrl({ dateFrom: e.target.value });
                      }}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">{t("dateRange.to")}</label>
                    <Input
                      type="date"
                      value={dateTo}
                      onChange={(e) => {
                        setDateTo(e.target.value);
                        updateUrl({ dateTo: e.target.value });
                      }}
                    />
                  </div>
                </div>
              </SheetContent>
            </Sheet>

            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="mr-2 h-4 w-4" />
                {t("clearFilters")}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Orders Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-4 p-6">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Package className="text-muted-foreground h-16 w-16" />
              <h3 className="mt-4 text-lg font-medium">{t("empty.title")}</h3>
              <p className="text-muted-foreground mt-2 text-sm">
                {hasActiveFilters ? t("empty.filtered") : t("empty.default")}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("headers.order")}</TableHead>
                  <TableHead>{t("headers.customer")}</TableHead>
                  <TableHead>{t("headers.date")}</TableHead>
                  <TableHead>{t("headers.status")}</TableHead>
                  <TableHead>{t("headers.payment")}</TableHead>
                  <TableHead className="text-right">{t("headers.total")}</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{order.orderNumber}</p>
                        <p className="text-muted-foreground text-sm">
                          {t("itemsCount", { count: order.itemCount })}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{order.user?.name || t("guest")}</p>
                        <p className="text-muted-foreground text-sm">{order.email}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{formatDate(order.createdAt)}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={getOrderStatusStyle(order.status)}>
                        {orderStatusLabel(order.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={getPaymentStatusStyle(order.paymentStatus)}
                      >
                        {paymentStatusLabel(order.paymentStatus)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatPrice(order.total)}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" asChild>
                        <Link href={`/admin/orders/${order.id}`}>
                          <Eye className="h-4 w-4" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground text-sm">
            {t("showingRange", {
              from: (pagination.page - 1) * pagination.limit + 1,
              to: Math.min(pagination.page * pagination.limit, pagination.total),
              total: pagination.total,
            })}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={!pagination.hasPrev}
            >
              <ChevronLeft className="h-4 w-4" />
              {tCommon("previous")}
            </Button>
            <span className="text-sm">
              {t("pageOf", { page: pagination.page, total: pagination.totalPages })}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={!pagination.hasNext}
            >
              {tCommon("next")}
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function AdminOrdersLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-8 w-32" />
          <Skeleton className="mt-2 h-4 w-48" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>
      <Skeleton className="h-20" />
      <Skeleton className="h-96" />
    </div>
  );
}

export default function AdminOrdersPage() {
  return (
    <Suspense fallback={<AdminOrdersLoading />}>
      <AdminOrdersContent />
    </Suspense>
  );
}
