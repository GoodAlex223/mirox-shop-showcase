"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Plus,
  Search,
  MoreHorizontal,
  Pencil,
  Trash2,
  Eye,
  Truck,
  ChevronLeft,
  ChevronRight,
  Wifi,
  WifiOff,
  Loader2,
  CheckCircle2,
  XCircle,
} from "lucide-react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

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
  _count: { products: number; supplierOrders: number };
  createdAt: string;
}

interface PaginatedResponse {
  data: Supplier[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

interface SupplierFormData {
  name: string;
  code: string;
  email: string;
  phone: string;
  website: string;
  apiEndpoint: string;
  apiKey: string;
  apiType: string;
  isActive: boolean;
  notes: string;
}

const initialFormData: SupplierFormData = {
  name: "",
  code: "",
  email: "",
  phone: "",
  website: "",
  apiEndpoint: "",
  apiKey: "",
  apiType: "",
  isActive: true,
  notes: "",
};

function SuppliersContent() {
  const t = useTranslations("admin.suppliers");
  const tCommon = useTranslations("admin.common");
  const router = useRouter();
  const searchParams = useSearchParams();

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Form dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [formData, setFormData] = useState<SupplierFormData>(initialFormData);
  const [isSaving, setIsSaving] = useState(false);

  // Connection test state
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<
    Record<string, { success: boolean; message: string }>
  >({});

  // Filters
  const [search, setSearch] = useState(searchParams?.get("search") || "");
  const [statusFilter, setStatusFilter] = useState(searchParams?.get("isActive") || "all");
  const [apiFilter, setApiFilter] = useState(searchParams?.get("hasApi") || "all");

  const fetchSuppliers = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", searchParams?.get("page") || "1");
      params.set("limit", "20");
      if (search) params.set("search", search);
      if (statusFilter !== "all") params.set("isActive", statusFilter);
      if (apiFilter !== "all") params.set("hasApi", apiFilter);

      const response = await fetch(`/api/admin/suppliers?${params}`);
      if (!response.ok) throw new Error("Failed to fetch suppliers");

      const data: PaginatedResponse = await response.json();
      setSuppliers(data.data);
      setPagination(data.pagination);
    } catch {
      toast.error(t("loadError"));
    } finally {
      setIsLoading(false);
    }
  }, [search, statusFilter, apiFilter, searchParams, t]);

  useEffect(() => {
    fetchSuppliers();
  }, [fetchSuppliers]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams(searchParams?.toString() || "");
    params.set("page", "1");
    if (search) params.set("search", search);
    else params.delete("search");
    router.push(`/admin/suppliers?${params}`);
  };

  const handleFilterChange = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams?.toString() || "");
    params.set("page", "1");
    if (value && value !== "all") params.set(key, value);
    else params.delete(key);
    router.push(`/admin/suppliers?${params}`);
  };

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams?.toString() || "");
    params.set("page", newPage.toString());
    router.push(`/admin/suppliers?${params}`);
  };

  const openCreateDialog = () => {
    setEditingSupplier(null);
    setFormData(initialFormData);
    setDialogOpen(true);
  };

  const openEditDialog = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setFormData({
      name: supplier.name,
      code: supplier.code,
      email: supplier.email || "",
      phone: supplier.phone || "",
      website: supplier.website || "",
      apiEndpoint: supplier.apiEndpoint || "",
      apiKey: "", // Don't show existing API key
      apiType: supplier.apiType || "",
      isActive: supplier.isActive,
      notes: supplier.notes || "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.code) {
      toast.error(t("form.nameCodeRequired"));
      return;
    }

    setIsSaving(true);
    try {
      const url = editingSupplier
        ? `/api/admin/suppliers/${editingSupplier.id}`
        : "/api/admin/suppliers";

      const body = {
        ...formData,
        email: formData.email || null,
        phone: formData.phone || null,
        website: formData.website || null,
        apiEndpoint: formData.apiEndpoint || null,
        apiKey: formData.apiKey || (editingSupplier ? undefined : null),
        apiType: formData.apiType || null,
        notes: formData.notes || null,
      };

      // If editing and apiKey is empty, remove it to preserve existing key
      if (editingSupplier && !formData.apiKey) {
        delete body.apiKey;
      }

      const response = await fetch(url, {
        method: editingSupplier ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || t("saveError"));
      }

      toast.success(editingSupplier ? t("updateSuccess") : t("createSuccess"));
      setDialogOpen(false);
      fetchSuppliers();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("saveError"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/admin/suppliers/${deleteId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || t("deleteError"));
      }

      toast.success(t("deleteSuccess"));
      fetchSuppliers();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("deleteError"));
    } finally {
      setIsDeleting(false);
      setDeleteId(null);
    }
  };

  const testConnection = async (supplierId: string) => {
    setTestingId(supplierId);
    try {
      const response = await fetch(`/api/admin/suppliers/${supplierId}/test-connection`, {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || t("testConnectionError"));
      }

      setTestResults((prev) => ({
        ...prev,
        [supplierId]: { success: data.success, message: data.message },
      }));

      if (data.success) {
        toast.success(data.message);
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : t("testConnectionError");
      setTestResults((prev) => ({
        ...prev,
        [supplierId]: { success: false, message },
      }));
      toast.error(message);
    } finally {
      setTestingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{t("title")}</h2>
          <p className="text-muted-foreground">{t("subtitle", { count: pagination.total })}</p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="mr-2 h-4 w-4" />
          {t("addButton")}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center">
        <form onSubmit={handleSearch} className="flex flex-1 gap-2">
          <div className="relative flex-1">
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

        <div className="flex gap-2">
          <Select
            value={statusFilter}
            onValueChange={(value) => {
              setStatusFilter(value);
              handleFilterChange("isActive", value);
            }}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder={t("statusFilter.placeholder")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("statusFilter.placeholder")}</SelectItem>
              <SelectItem value="true">{t("statusFilter.active")}</SelectItem>
              <SelectItem value="false">{t("statusFilter.inactive")}</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={apiFilter}
            onValueChange={(value) => {
              setApiFilter(value);
              handleFilterChange("hasApi", value);
            }}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder={t("apiFilter.placeholder")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("apiFilter.all")}</SelectItem>
              <SelectItem value="true">{t("apiFilter.withApi")}</SelectItem>
              <SelectItem value="false">{t("apiFilter.withoutApi")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("headers.supplier")}</TableHead>
              <TableHead>{t("headers.code")}</TableHead>
              <TableHead>{t("headers.contact")}</TableHead>
              <TableHead className="text-center">{t("headers.products")}</TableHead>
              <TableHead className="text-center">{t("headers.orders")}</TableHead>
              <TableHead className="text-center">{t("headers.api")}</TableHead>
              <TableHead className="text-center">{t("headers.status")}</TableHead>
              <TableHead className="w-[70px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center">
                  {tCommon("loading")}
                </TableCell>
              </TableRow>
            ) : suppliers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <Truck className="text-muted-foreground h-8 w-8" />
                    <p className="text-muted-foreground">{t("empty.title")}</p>
                    <Button size="sm" onClick={openCreateDialog}>
                      {t("empty.addFirstButton")}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              suppliers.map((supplier) => (
                <TableRow key={supplier.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{supplier.name}</p>
                      {supplier.website && (
                        <a
                          href={supplier.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground text-sm hover:underline"
                        >
                          {new URL(supplier.website).hostname}
                        </a>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-sm">{supplier.code}</TableCell>
                  <TableCell>
                    <div className="space-y-1 text-sm">
                      {supplier.email && <p className="text-muted-foreground">{supplier.email}</p>}
                      {supplier.phone && <p className="text-muted-foreground">{supplier.phone}</p>}
                      {!supplier.email && !supplier.phone && (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary">{supplier._count.products}</Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary">{supplier._count.supplierOrders}</Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    {supplier.apiEndpoint ? (
                      <div className="flex items-center justify-center gap-1">
                        {testingId === supplier.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : testResults[supplier.id] ? (
                          testResults[supplier.id].success ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-500" />
                          )
                        ) : (
                          <Wifi className="h-4 w-4 text-blue-500" />
                        )}
                        <span className="text-sm">{supplier.apiType || t("headers.api")}</span>
                      </div>
                    ) : (
                      <WifiOff className="text-muted-foreground mx-auto h-4 w-4" />
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant={supplier.isActive ? "default" : "outline"}>
                      {supplier.isActive ? t("statusFilter.active") : t("statusFilter.inactive")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => router.push(`/admin/suppliers/${supplier.id}`)}
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          {t("viewDetails")}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openEditDialog(supplier)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          {tCommon("edit")}
                        </DropdownMenuItem>
                        {supplier.apiEndpoint && (
                          <DropdownMenuItem
                            onClick={() => testConnection(supplier.id)}
                            disabled={testingId === supplier.id}
                          >
                            <Wifi className="mr-2 h-4 w-4" />
                            {t("testConnection")}
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => setDeleteId(supplier.id)}
                          disabled={
                            supplier._count.products > 0 || supplier._count.supplierOrders > 0
                          }
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

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingSupplier ? t("form.editTitle") : t("form.createTitle")}
            </DialogTitle>
            <DialogDescription>
              {editingSupplier ? t("form.editDescription") : t("form.createDescription")}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">{t("form.nameLabel")}</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder={t("form.namePlaceholder")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="code">{t("form.codeLabel")}</Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      code: e.target.value.toUpperCase(),
                    })
                  }
                  placeholder={t("form.codePlaceholder")}
                  className="uppercase"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">{t("form.emailLabel")}</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder={t("form.emailPlaceholder")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">{t("form.phoneLabel")}</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder={t("form.phonePlaceholder")}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="website">{t("form.websiteLabel")}</Label>
              <Input
                id="website"
                value={formData.website}
                onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                placeholder={t("form.websitePlaceholder")}
              />
            </div>

            <div className="border-t pt-4">
              <h4 className="mb-3 font-medium">{t("form.apiConfigTitle")}</h4>
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="apiEndpoint">{t("form.apiEndpointLabel")}</Label>
                  <Input
                    id="apiEndpoint"
                    value={formData.apiEndpoint}
                    onChange={(e) => setFormData({ ...formData, apiEndpoint: e.target.value })}
                    placeholder={t("form.apiEndpointPlaceholder")}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="apiKey">
                      {t("form.apiKeyLabel")}{" "}
                      {editingSupplier && (
                        <span className="text-muted-foreground">{t("form.apiKeyHint")}</span>
                      )}
                    </Label>
                    <Input
                      id="apiKey"
                      type="password"
                      value={formData.apiKey}
                      onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                      placeholder={t("form.apiKeyPlaceholder")}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="apiType">{t("form.apiTypeLabel")}</Label>
                    <Select
                      value={formData.apiType}
                      onValueChange={(value) => setFormData({ ...formData, apiType: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t("form.apiTypePlaceholder")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bearer">{t("form.apiTypeBearer")}</SelectItem>
                        <SelectItem value="api-key">{t("form.apiTypeApiKeyHeader")}</SelectItem>
                        <SelectItem value="basic">{t("form.apiTypeBasic")}</SelectItem>
                        <SelectItem value="custom">{t("form.apiTypeCustom")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">{t("form.notesLabel")}</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder={t("form.notesPlaceholder")}
                rows={3}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
              />
              <Label htmlFor="isActive">{t("form.activeLabel")}</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {tCommon("cancel")}
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("form.saving")}
                </>
              ) : editingSupplier ? (
                t("form.updateButton")
              ) : (
                t("form.createButton")
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteDialog.title")}</AlertDialogTitle>
            <AlertDialogDescription>{t("deleteDialog.confirmText")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? t("deleteDialog.deleting") : tCommon("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SuppliersLoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="bg-muted h-8 w-32 rounded" />
          <div className="bg-muted mt-2 h-4 w-48 rounded" />
        </div>
        <div className="bg-muted h-10 w-32 rounded" />
      </div>
      <div className="flex gap-4">
        <div className="bg-muted h-10 flex-1 rounded" />
        <div className="bg-muted h-10 w-[140px] rounded" />
        <div className="bg-muted h-10 w-[160px] rounded" />
      </div>
      <div className="rounded-md border">
        <div className="bg-muted/20 h-[400px]" />
      </div>
    </div>
  );
}

export default function AdminSuppliersPage() {
  return (
    <Suspense fallback={<SuppliersLoadingSkeleton />}>
      <SuppliersContent />
    </Suspense>
  );
}
