"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, Users, Mail, ShoppingCart, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { formatPrice } from "@/lib/format";

interface Customer {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  createdAt: string;
  orderCount: number;
  totalSpent: number;
}

interface PaginatedResponse {
  data: Customer[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export default function AdminCustomersPage() {
  const t = useTranslations("admin.customers");
  const tCommon = useTranslations("admin.common");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchCustomers = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", pagination.page.toString());
      params.set("limit", pagination.limit.toString());
      if (search) params.set("search", search);

      const response = await fetch(`/api/admin/customers?${params}`);
      if (!response.ok) throw new Error("Failed to fetch customers");

      const data: PaginatedResponse = await response.json();
      setCustomers(data.data);
      setPagination((prev) => ({ ...prev, ...data.pagination }));
    } catch {
      toast.error(t("loadError"));
    } finally {
      setIsLoading(false);
    }
  }, [pagination.page, pagination.limit, search, t]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPagination((prev) => ({ ...prev, page: 1 }));
    fetchCustomers();
  };

  const getInitials = (name: string | null) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("uk-UA", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            placeholder={t("searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button type="submit" variant="secondary">
          {tCommon("search")}
        </Button>
      </form>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("headers.customer")}</TableHead>
              <TableHead>{t("headers.email")}</TableHead>
              <TableHead className="text-center">{t("headers.orders")}</TableHead>
              <TableHead className="text-right">{t("headers.totalSpent")}</TableHead>
              <TableHead>{t("headers.joined")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="bg-muted h-10 w-10 animate-pulse rounded-full" />
                      <div className="bg-muted h-5 w-32 animate-pulse rounded" />
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="bg-muted h-5 w-48 animate-pulse rounded" />
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="bg-muted mx-auto h-5 w-8 animate-pulse rounded" />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="bg-muted ml-auto h-5 w-20 animate-pulse rounded" />
                  </TableCell>
                  <TableCell>
                    <div className="bg-muted h-5 w-24 animate-pulse rounded" />
                  </TableCell>
                </TableRow>
              ))
            ) : customers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center">
                  <div className="flex flex-col items-center justify-center">
                    <Users className="text-muted-foreground h-10 w-10" />
                    <p className="text-muted-foreground mt-2 text-sm">{t("empty")}</p>
                    {search && (
                      <p className="text-muted-foreground mt-1 text-xs">{t("tryAdjusting")}</p>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              customers.map((customer) => (
                <TableRow key={customer.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarImage src={customer.image || undefined} />
                        <AvatarFallback>{getInitials(customer.name)}</AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{customer.name || t("anonymous")}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Mail className="text-muted-foreground h-4 w-4" />
                      {customer.email}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <ShoppingCart className="text-muted-foreground h-4 w-4" />
                      {customer.orderCount}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatPrice(customer.totalSpent)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Calendar className="text-muted-foreground h-4 w-4" />
                      {formatDate(customer.createdAt)}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

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
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page <= 1}
              onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
            >
              {tCommon("previous")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
            >
              {tCommon("next")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
