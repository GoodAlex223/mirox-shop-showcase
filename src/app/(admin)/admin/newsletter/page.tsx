"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Mail, Search, Trash2, Download, Loader2, Copy, UserCheck, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { useDebounce } from "@/hooks/use-debounce";

interface Subscriber {
  id: string;
  email: string;
  status: "PENDING" | "ACTIVE" | "UNSUBSCRIBED";
  subscribedAt: string | null;
  unsubscribedAt: string | null;
  createdAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

function SubscribersContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations("admin.newsletter");
  const tCommon = useTranslations("admin.common");

  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [search, setSearch] = useState(searchParams?.get("search") || "");
  const [statusFilter, setStatusFilter] = useState(searchParams?.get("status") || "all");
  const debouncedSearch = useDebounce(search, 300);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchSubscribers = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", searchParams?.get("page") || "1");
      params.set("limit", "20");
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (statusFilter !== "all") params.set("status", statusFilter);

      const response = await fetch(`/api/admin/newsletter?${params}`);
      if (!response.ok) throw new Error("Failed to fetch subscribers");

      const data = await response.json();
      setSubscribers(data.data);
      setPagination(data.pagination);
    } catch {
      toast.error(t("loadError"));
    } finally {
      setIsLoading(false);
    }
  }, [searchParams, debouncedSearch, statusFilter, t]);

  useEffect(() => {
    fetchSubscribers();
  }, [fetchSubscribers]);

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams?.toString() || "");
    params.set("page", newPage.toString());
    router.push(`/admin/newsletter?${params}`);
  };

  const handleUpdateStatus = async (
    subscriber: Subscriber,
    newStatus: "ACTIVE" | "UNSUBSCRIBED"
  ) => {
    try {
      const response = await fetch(`/api/admin/newsletter/${subscriber.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) throw new Error("Failed to update status");

      toast.success(newStatus === "ACTIVE" ? t("activateSuccess") : t("unsubscribeSuccess"));
      fetchSubscribers();
    } catch {
      toast.error(t("updateError"));
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/admin/newsletter/${deleteId}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete subscriber");

      toast.success(t("deleteSuccess"));
      setDeleteId(null);
      fetchSubscribers();
    } catch {
      toast.error(t("deleteError"));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCopyEmail = (email: string) => {
    navigator.clipboard.writeText(email);
    toast.success(t("copySuccess"));
  };

  const handleExport = () => {
    const params = new URLSearchParams();
    if (statusFilter !== "all") params.set("status", statusFilter);
    window.open(`/api/admin/newsletter/export?${params}`, "_blank");
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("uk-UA", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getStatusBadge = (status: Subscriber["status"]) => {
    switch (status) {
      case "ACTIVE":
        // Token-driven default badge (bg-primary/text-primary-foreground), matching
        // the isActive="default" convention on the products list — not a status-color
        // map, so not exempt; and no green (TASK-037 owns status green).
        return <Badge>{t("status.ACTIVE")}</Badge>;
      case "PENDING":
        return <Badge variant="secondary">{t("status.PENDING")}</Badge>;
      case "UNSUBSCRIBED":
        return <Badge variant="destructive">{t("status.UNSUBSCRIBED")}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
        </div>
        <Button variant="outline" onClick={handleExport}>
          <Download className="mr-2 h-4 w-4" />
          {t("export")}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative max-w-xs flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            placeholder={t("searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder={t("statusFilter.placeholder")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("statusFilter.all")}</SelectItem>
            <SelectItem value="ACTIVE">{t("status.ACTIVE")}</SelectItem>
            <SelectItem value="PENDING">{t("status.PENDING")}</SelectItem>
            <SelectItem value="UNSUBSCRIBED">{t("status.UNSUBSCRIBED")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("headers.email")}</TableHead>
              <TableHead>{t("headers.status")}</TableHead>
              <TableHead className="hidden md:table-cell">{t("headers.subscribed")}</TableHead>
              <TableHead>{t("headers.created")}</TableHead>
              <TableHead className="w-[80px]">{tCommon("actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Skeleton className="h-4 w-48" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-20" />
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-8" />
                  </TableCell>
                </TableRow>
              ))
            ) : subscribers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-12 text-center">
                  <Mail className="text-muted-foreground mx-auto h-8 w-8" />
                  <p className="text-muted-foreground mt-2">{t("empty")}</p>
                </TableCell>
              </TableRow>
            ) : (
              subscribers.map((subscriber) => (
                <TableRow key={subscriber.id}>
                  <TableCell className="font-medium">{subscriber.email}</TableCell>
                  <TableCell>{getStatusBadge(subscriber.status)}</TableCell>
                  <TableCell className="hidden text-sm md:table-cell">
                    {subscriber.subscribedAt ? formatDate(subscriber.subscribedAt) : "—"}
                  </TableCell>
                  <TableCell className="text-sm">{formatDate(subscriber.createdAt)}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm">
                          <span className="sr-only">{tCommon("actions")}</span>
                          <span className="text-lg">&#8943;</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleCopyEmail(subscriber.email)}>
                          <Copy className="mr-2 h-4 w-4" />
                          {t("copyEmail")}
                        </DropdownMenuItem>
                        {subscriber.status !== "ACTIVE" && (
                          <DropdownMenuItem
                            onClick={() => handleUpdateStatus(subscriber, "ACTIVE")}
                          >
                            <UserCheck className="mr-2 h-4 w-4" />
                            {t("activate")}
                          </DropdownMenuItem>
                        )}
                        {subscriber.status === "ACTIVE" && (
                          <DropdownMenuItem
                            onClick={() => handleUpdateStatus(subscriber, "UNSUBSCRIBED")}
                          >
                            <UserX className="mr-2 h-4 w-4" />
                            {t("unsubscribe")}
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => setDeleteId(subscriber.id)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          {tCommon("delete")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
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
              disabled={!pagination.hasPrev}
              onClick={() => handlePageChange(pagination.page - 1)}
            >
              {tCommon("previous")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!pagination.hasNext}
              onClick={() => handlePageChange(pagination.page + 1)}
            >
              {tCommon("next")}
            </Button>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteDialog.title")}</AlertDialogTitle>
            <AlertDialogDescription>{t("deleteDialog.confirmText")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>{tCommon("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isDeleting ? t("deleteDialog.deleting") : tCommon("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SubscribersLoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="mt-2 h-4 w-64" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="flex gap-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-10 w-[160px]" />
      </div>
      <Skeleton className="h-[400px] w-full rounded-md" />
    </div>
  );
}

export default function AdminNewsletterPage() {
  return (
    <Suspense fallback={<SubscribersLoadingSkeleton />}>
      <SubscribersContent />
    </Suspense>
  );
}
