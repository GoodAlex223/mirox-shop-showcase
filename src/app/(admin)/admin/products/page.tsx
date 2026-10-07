"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Plus,
  Search,
  MoreHorizontal,
  Pencil,
  Trash2,
  Eye,
  Package,
  ChevronLeft,
  ChevronRight,
  Upload,
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
import { ProductImportDialog } from "@/components/admin";
import { formatPrice } from "@/lib/format";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

interface Product {
  id: string;
  name: string;
  slug: string;
  sku: string;
  price: string;
  stock: number;
  isActive: boolean;
  isFeatured: boolean;
  category: { id: string; name: string; slug: string };
  supplier: { id: string; name: string; code: string } | null;
  images: { id: string; url: string; alt: string | null }[];
  _count: { variants: number; orderItems: number };
  createdAt: string;
}

interface Category {
  id: string;
  name: string;
}

interface PaginatedResponse {
  data: Product[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

function ProductsContent() {
  const t = useTranslations("admin.products");
  const tCommon = useTranslations("admin.common");
  const router = useRouter();
  const searchParams = useSearchParams();

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
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
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  // Filters
  const [search, setSearch] = useState(searchParams?.get("search") || "");
  const [categoryId, setCategoryId] = useState(searchParams?.get("categoryId") || "");
  const [status, setStatus] = useState(searchParams?.get("isActive") || "");

  const fetchProducts = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", searchParams?.get("page") || "1");
      params.set("limit", "20");
      if (search) params.set("search", search);
      if (categoryId) params.set("categoryId", categoryId);
      if (status) params.set("isActive", status);

      const response = await fetch(`/api/admin/products?${params}`);
      if (!response.ok) throw new Error("Failed to fetch products");

      const data: PaginatedResponse = await response.json();
      setProducts(data.data);
      setPagination(data.pagination);
    } catch {
      toast.error(t("loadError"));
    } finally {
      setIsLoading(false);
    }
  }, [search, categoryId, status, searchParams, t]);

  const fetchCategories = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/categories?all=true");
      if (!response.ok) throw new Error("Failed to fetch categories");
      const data = await response.json();
      setCategories(data);
    } catch (error) {
      console.error("Error fetching categories:", error);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams(searchParams?.toString() || "");
    params.set("page", "1");
    if (search) params.set("search", search);
    else params.delete("search");
    router.push(`/admin/products?${params}`);
  };

  const handleFilterChange = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams?.toString() || "");
    params.set("page", "1");
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`/admin/products?${params}`);
  };

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams?.toString() || "");
    params.set("page", newPage.toString());
    router.push(`/admin/products?${params}`);
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/admin/products/${deleteId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || t("deleteError"));
      }

      toast.success(t("deleteSuccess"));
      fetchProducts();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("deleteError"));
    } finally {
      setIsDeleting(false);
      setDeleteId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{t("title")}</h2>
          <p className="text-muted-foreground">{t("subtitle", { count: pagination.total })}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setImportDialogOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            {t("importCsv")}
          </Button>
          <Link href="/admin/products/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              {t("addButton")}
            </Button>
          </Link>
        </div>
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
            value={categoryId || "all"}
            onValueChange={(value) => {
              const newValue = value === "all" ? "" : value;
              setCategoryId(newValue);
              handleFilterChange("categoryId", newValue);
            }}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder={t("categoryFilter.placeholder")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("categoryFilter.placeholder")}</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={status || "all"}
            onValueChange={(value) => {
              const newValue = value === "all" ? "" : value;
              setStatus(newValue);
              handleFilterChange("isActive", newValue);
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
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[80px]">{t("headers.image")}</TableHead>
              <TableHead>{t("headers.product")}</TableHead>
              <TableHead>{t("headers.sku")}</TableHead>
              <TableHead>{t("headers.category")}</TableHead>
              <TableHead className="text-right">{t("headers.price")}</TableHead>
              <TableHead className="text-center">{t("headers.stock")}</TableHead>
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
            ) : products.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <Package className="text-muted-foreground h-8 w-8" />
                    <p className="text-muted-foreground">{t("empty.title")}</p>
                    <Link href="/admin/products/new">
                      <Button size="sm">{t("empty.addFirstButton")}</Button>
                    </Link>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              products.map((product) => (
                <TableRow key={product.id}>
                  <TableCell>
                    {product.images[0] ? (
                      <Image
                        src={product.images[0].url}
                        alt={product.images[0].alt || product.name}
                        width={48}
                        height={48}
                        className="h-12 w-12 rounded object-cover"
                      />
                    ) : (
                      <div className="bg-muted flex h-12 w-12 items-center justify-center rounded">
                        <Package className="text-muted-foreground h-6 w-6" />
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{product.name}</p>
                      {product.isFeatured && (
                        <Badge variant="secondary" className="mt-1">
                          {t("featured")}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-sm">{product.sku}</TableCell>
                  <TableCell>{product.category.name}</TableCell>
                  <TableCell className="text-right font-medium">
                    {formatPrice(product.price)}
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
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/products/${product.slug}`}>
                            <Eye className="mr-2 h-4 w-4" />
                            {t("view")}
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href={`/admin/products/${product.id}`}>
                            <Pencil className="mr-2 h-4 w-4" />
                            {tCommon("edit")}
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => setDeleteId(product.id)}
                          disabled={product._count.orderItems > 0}
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

      {/* Import Dialog */}
      <ProductImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        onImportComplete={fetchProducts}
      />
    </div>
  );
}

function ProductsLoadingSkeleton() {
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
        <div className="bg-muted h-10 w-[180px] rounded" />
        <div className="bg-muted h-10 w-[140px] rounded" />
      </div>
      <div className="rounded-md border">
        <div className="bg-muted/20 h-[400px]" />
      </div>
    </div>
  );
}

export default function AdminProductsPage() {
  return (
    <Suspense fallback={<ProductsLoadingSkeleton />}>
      <ProductsContent />
    </Suspense>
  );
}
