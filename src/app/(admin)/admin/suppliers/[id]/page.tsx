"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Pencil,
  Trash2,
  Wifi,
  WifiOff,
  Loader2,
  CheckCircle2,
  XCircle,
  Package,
  ShoppingCart,
  ExternalLink,
  Mail,
  Phone,
  Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Skeleton } from "@/components/ui/skeleton";
import { formatPrice } from "@/lib/format";
import { getSupplierOrderStatusStyle } from "@/lib/supplier-order-status";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

interface Product {
  id: string;
  name: string;
  sku: string;
  supplierSku: string | null;
  price: string;
  supplierPrice: string | null;
  stock: number;
  isActive: boolean;
}

interface SupplierOrder {
  id: string;
  orderId: string;
  supplierOrderId: string | null;
  status: string;
  trackingNumber: string | null;
  cost: string | null;
  createdAt: string;
  order: { orderNumber: string };
}

interface Supplier {
  id: string;
  name: string;
  code: string;
  email: string | null;
  phone: string | null;
  website: string | null;
  apiEndpoint: string | null;
  apiKey: string | null;
  apiType: string | null;
  isActive: boolean;
  notes: string | null;
  products: Product[];
  supplierOrders: SupplierOrder[];
  _count: { products: number; supplierOrders: number };
  createdAt: string;
  updatedAt: string;
}

// apiType is a plain string driven by a fixed <SelectItem> vocabulary in the
// list page's create/edit form (Task 8) — map it onto that form's labels,
// falling back to the raw value for any legacy/out-of-band value.
const API_TYPE_LABEL_KEYS: Record<string, string> = {
  bearer: "form.apiTypeBearer",
  "api-key": "form.apiTypeApiKeyHeader",
  basic: "form.apiTypeBasic",
  custom: "form.apiTypeCustom",
};

export default function SupplierDetailPage() {
  // non-null: the pages-compat types in next-env.d.ts make useParams() nullable; App Router always supplies params
  const { id } = useParams<{ id: string }>()!;
  const router = useRouter();
  const t = useTranslations("admin.suppliers");
  const tCommon = useTranslations("admin.common");
  const tSupplierStatus = useTranslations("admin.supplierOrderStatus");
  const apiTypeLabel = (value: string) => {
    const key = API_TYPE_LABEL_KEYS[value];
    return key && t.has(key as never) ? t(key as never) : value;
  };

  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  useEffect(() => {
    const fetchSupplier = async () => {
      try {
        const response = await fetch(`/api/admin/suppliers/${id}`);
        if (!response.ok) {
          if (response.status === 404) {
            toast.error(t("detail.notFound"));
            router.push("/admin/suppliers");
            return;
          }
          throw new Error("Failed to fetch supplier");
        }
        const data = await response.json();
        setSupplier(data);
      } catch {
        toast.error(t("detail.loadError"));
      } finally {
        setIsLoading(false);
      }
    };

    fetchSupplier();
  }, [id, router, t]);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/admin/suppliers/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || t("deleteError"));
      }

      toast.success(t("deleteSuccess"));
      router.push("/admin/suppliers");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("deleteError"));
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  const testConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const response = await fetch(`/api/admin/suppliers/${id}/test-connection`, {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || t("testConnectionError"));
      }

      setTestResult({ success: data.success, message: data.message });

      if (data.success) {
        toast.success(data.message);
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : t("testConnectionError");
      setTestResult({ success: false, message });
      toast.error(message);
    } finally {
      setIsTesting(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("uk-UA", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-8 w-64" />
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-[200px]" />
          <Skeleton className="h-[200px]" />
        </div>
        <Skeleton className="h-[300px]" />
      </div>
    );
  }

  if (!supplier) {
    return null;
  }

  const canDelete = supplier._count.products === 0 && supplier._count.supplierOrders === 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/admin/suppliers">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold tracking-tight">{supplier.name}</h2>
              <Badge variant={supplier.isActive ? "default" : "secondary"}>
                {supplier.isActive ? t("statusFilter.active") : t("statusFilter.inactive")}
              </Badge>
            </div>
            <p className="text-muted-foreground">
              {t("detail.codeLabel", { code: supplier.code })}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => router.push(`/admin/suppliers?edit=${supplier.id}`)}
          >
            <Pencil className="mr-2 h-4 w-4" />
            {tCommon("edit")}
          </Button>
          <Button
            variant="destructive"
            onClick={() => setDeleteDialogOpen(true)}
            disabled={!canDelete}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {tCommon("delete")}
          </Button>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Contact Info */}
        <Card>
          <CardHeader>
            <CardTitle>{t("detail.contactInfo.title")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {supplier.email && (
              <div className="flex items-center gap-2">
                <Mail className="text-muted-foreground h-4 w-4" />
                <a href={`mailto:${supplier.email}`} className="text-sm hover:underline">
                  {supplier.email}
                </a>
              </div>
            )}
            {supplier.phone && (
              <div className="flex items-center gap-2">
                <Phone className="text-muted-foreground h-4 w-4" />
                <a href={`tel:${supplier.phone}`} className="text-sm hover:underline">
                  {supplier.phone}
                </a>
              </div>
            )}
            {supplier.website && (
              <div className="flex items-center gap-2">
                <Globe className="text-muted-foreground h-4 w-4" />
                <a
                  href={supplier.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-sm hover:underline"
                >
                  {new URL(supplier.website).hostname}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}
            {!supplier.email && !supplier.phone && !supplier.website && (
              <p className="text-muted-foreground text-sm">{t("detail.contactInfo.empty")}</p>
            )}
            {supplier.notes && (
              <div className="border-t pt-3">
                <p className="text-muted-foreground text-sm">{supplier.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* API Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {t("form.apiConfigTitle")}
              {supplier.apiEndpoint ? (
                <Wifi className="h-4 w-4 text-blue-500" />
              ) : (
                <WifiOff className="text-muted-foreground h-4 w-4" />
              )}
            </CardTitle>
            <CardDescription>
              {supplier.apiEndpoint
                ? t("detail.apiConfig.configuredDescription")
                : t("detail.apiConfig.notConfiguredDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {supplier.apiEndpoint ? (
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium">{t("detail.apiConfig.endpointLabel")}</p>
                  <p className="text-muted-foreground font-mono text-sm break-all">
                    {supplier.apiEndpoint}
                  </p>
                </div>
                {supplier.apiType && (
                  <div>
                    <p className="text-sm font-medium">{t("detail.apiConfig.authTypeLabel")}</p>
                    <p className="text-muted-foreground text-sm capitalize">
                      {apiTypeLabel(supplier.apiType)}
                    </p>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={testConnection} disabled={isTesting}>
                    {isTesting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {t("detail.testing")}
                      </>
                    ) : (
                      <>
                        <Wifi className="mr-2 h-4 w-4" />
                        {t("testConnection")}
                      </>
                    )}
                  </Button>
                  {testResult && (
                    <div className="flex items-center gap-1">
                      {testResult.success ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                      <span
                        className={`text-sm ${
                          testResult.success ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {testResult.message}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">
                {t("detail.apiConfig.notConfiguredHint")}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Statistics */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="bg-muted rounded-full p-3">
              <Package className="text-foreground h-6 w-6" />
            </div>
            <div>
              <p className="text-2xl font-bold">{supplier._count.products}</p>
              <p className="text-muted-foreground text-sm">{t("headers.products")}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="bg-muted rounded-full p-3">
              <ShoppingCart className="text-foreground h-6 w-6" />
            </div>
            <div>
              <p className="text-2xl font-bold">{supplier._count.supplierOrders}</p>
              <p className="text-muted-foreground text-sm">{t("headers.orders")}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Products */}
      <Card>
        <CardHeader>
          <CardTitle>{t("detail.recentProducts.title")}</CardTitle>
          <CardDescription>{t("detail.recentProducts.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          {supplier.products.length === 0 ? (
            <p className="text-muted-foreground py-4 text-center text-sm">
              {t("detail.recentProducts.empty")}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("detail.productsTable.product")}</TableHead>
                  <TableHead>{t("detail.productsTable.sku")}</TableHead>
                  <TableHead>{t("detail.productsTable.supplierSku")}</TableHead>
                  <TableHead className="text-right">{t("detail.productsTable.ourPrice")}</TableHead>
                  <TableHead className="text-right">
                    {t("detail.productsTable.supplierPrice")}
                  </TableHead>
                  <TableHead className="text-center">{t("detail.productsTable.stock")}</TableHead>
                  <TableHead className="text-center">{t("headers.status")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {supplier.products.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell>
                      <Link
                        href={`/admin/products/${product.id}`}
                        className="font-medium hover:underline"
                      >
                        {product.name}
                      </Link>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{product.sku}</TableCell>
                    <TableCell className="font-mono text-sm">
                      {product.supplierSku || "-"}
                    </TableCell>
                    <TableCell className="text-right">{formatPrice(product.price)}</TableCell>
                    <TableCell className="text-right">
                      {product.supplierPrice ? formatPrice(product.supplierPrice) : "-"}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant={
                          product.stock > 10
                            ? "default"
                            : product.stock > 0
                              ? "secondary"
                              : "destructive"
                        }
                      >
                        {product.stock}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={product.isActive ? "default" : "outline"}>
                        {product.isActive ? t("statusFilter.active") : t("statusFilter.inactive")}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Recent Supplier Orders */}
      <Card>
        <CardHeader>
          <CardTitle>{t("detail.recentOrders.title")}</CardTitle>
          <CardDescription>{t("detail.recentOrders.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          {supplier.supplierOrders.length === 0 ? (
            <p className="text-muted-foreground py-4 text-center text-sm">
              {t("detail.recentOrders.empty")}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("detail.ordersTable.orderNumber")}</TableHead>
                  <TableHead>{t("detail.ordersTable.supplierOrderId")}</TableHead>
                  <TableHead>{t("headers.status")}</TableHead>
                  <TableHead>{t("detail.ordersTable.tracking")}</TableHead>
                  <TableHead className="text-right">{t("detail.ordersTable.cost")}</TableHead>
                  <TableHead>{t("detail.ordersTable.date")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {supplier.supplierOrders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell>
                      <Link
                        href={`/admin/orders/${order.orderId}`}
                        className="font-medium hover:underline"
                      >
                        {order.order.orderNumber}
                      </Link>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {order.supplierOrderId || "-"}
                    </TableCell>
                    <TableCell>
                      <Badge className={getSupplierOrderStatusStyle(order.status)}>
                        {tSupplierStatus.has(order.status as never)
                          ? tSupplierStatus(order.status as never)
                          : order.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {order.trackingNumber || <span className="text-muted-foreground">-</span>}
                    </TableCell>
                    <TableCell className="text-right">
                      {order.cost ? formatPrice(order.cost) : "-"}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDate(order.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteDialog.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {canDelete
                ? t("deleteDialog.confirmText")
                : t("detail.deleteBlocked", {
                    products: supplier._count.products,
                    orders: supplier._count.supplierOrders,
                  })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon("cancel")}</AlertDialogCancel>
            {canDelete && (
              <AlertDialogAction
                onClick={handleDelete}
                disabled={isDeleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isDeleting ? t("deleteDialog.deleting") : tCommon("delete")}
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
