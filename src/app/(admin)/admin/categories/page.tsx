"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import {
  Plus,
  Search,
  MoreHorizontal,
  Pencil,
  Trash2,
  ChevronRight,
  FolderTree,
  Package,
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { generateSlug } from "@/lib/slug";

interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image: string | null;
  isActive: boolean;
  sortOrder: number;
  parentId: string | null;
  parent: { id: string; name: string; slug: string } | null;
  _count: { products: number; children: number };
}

interface PaginatedResponse {
  data: Category[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export default function AdminCategoriesPage() {
  const t = useTranslations("admin.categories");
  const tCommon = useTranslations("admin.common");
  const [categories, setCategories] = useState<Category[]>([]);
  const [allCategories, setAllCategories] = useState<
    { id: string; name: string; slug: string; parentId: string | null }[]
  >([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [parentFilter, setParentFilter] = useState<string>("all");

  // Dialog states
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // G24: while creating, the slug follows the name until the admin edits the
  // slug field; editing an existing category never re-derives it, so a rename
  // keeps the category's URL. (The old `prev.slug || generateSlug(name)` froze
  // on the first keystroke's slug once names transliterated.)
  const [slugEdited, setSlugEdited] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    description: "",
    image: "",
    parentId: "",
    isActive: true,
    sortOrder: 0,
  });

  const fetchCategories = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", pagination.page.toString());
      params.set("limit", pagination.limit.toString());
      if (search) params.set("search", search);
      if (parentFilter === "root") params.set("parentId", "null");
      else if (parentFilter !== "all") params.set("parentId", parentFilter);

      const response = await fetch(`/api/admin/categories?${params}`);
      if (!response.ok) throw new Error("Failed to fetch categories");

      const data: PaginatedResponse = await response.json();
      setCategories(data.data);
      setPagination((prev) => ({ ...prev, ...data.pagination }));
    } catch {
      toast.error(t("loadError"));
    } finally {
      setIsLoading(false);
    }
  }, [pagination.page, pagination.limit, search, parentFilter, t]);

  const fetchAllCategories = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/categories?all=true");
      if (!response.ok) throw new Error("Failed to fetch categories");
      const data = await response.json();
      setAllCategories(data);
    } catch (error) {
      console.error("Error fetching all categories:", error);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    fetchAllCategories();
  }, [fetchAllCategories]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPagination((prev) => ({ ...prev, page: 1 }));
    fetchCategories();
  };

  const openCreateDialog = () => {
    setSelectedCategory(null);
    setSlugEdited(false);
    setFormData({
      name: "",
      slug: "",
      description: "",
      image: "",
      parentId: "",
      isActive: true,
      sortOrder: 0,
    });
    setEditDialogOpen(true);
  };

  const openEditDialog = (category: Category) => {
    setSelectedCategory(category);
    setSlugEdited(true);
    setFormData({
      name: category.name,
      slug: category.slug,
      description: category.description || "",
      image: category.image || "",
      parentId: category.parentId || "",
      isActive: category.isActive,
      sortOrder: category.sortOrder,
    });
    setEditDialogOpen(true);
  };

  const openDeleteDialog = (category: Category) => {
    setSelectedCategory(category);
    setDeleteDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const url = selectedCategory
        ? `/api/admin/categories/${selectedCategory.id}`
        : "/api/admin/categories";
      const method = selectedCategory ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          // categorySchema.image is a URL and rejects "" — a blank field goes
          // as null, like parentId (G24).
          image: formData.image.trim() || null,
          parentId: formData.parentId || null,
          sortOrder: Number(formData.sortOrder),
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => null);
        toast.error(errorMessageForCode(error?.code));
        return;
      }

      toast.success(selectedCategory ? t("updateSuccess") : t("createSuccess"));

      setEditDialogOpen(false);
      fetchCategories();
      fetchAllCategories();
    } catch {
      toast.error(t("saveError"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedCategory) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/admin/categories/${selectedCategory.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete category");
      }

      toast.success(t("deleteSuccess"));

      setDeleteDialogOpen(false);
      fetchCategories();
      fetchAllCategories();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("deleteError"));
    } finally {
      setIsSubmitting(false);
    }
  };

  // The API answers with English `error` prose (log text) plus a machine
  // `code`; the dialog shows the catalog's copy for the code and never `error`
  // itself (G24 — the ProductVariantsSection pattern).
  const errorMessageForCode = (code?: string) => {
    const key = code ? `byCode.${code}` : "";
    return key && t.has(key as never) ? t(key as never) : t("saveError");
  };

  // Get parent categories (exclude the category being edited and its children)
  const getAvailableParents = () => {
    if (!selectedCategory) return allCategories.filter((c) => !c.parentId);

    const excludeIds = new Set<string>([selectedCategory.id]);

    // Find all children recursively
    const findChildren = (parentId: string) => {
      allCategories.forEach((c) => {
        if (c.parentId === parentId && !excludeIds.has(c.id)) {
          excludeIds.add(c.id);
          findChildren(c.id);
        }
      });
    };
    findChildren(selectedCategory.id);

    return allCategories.filter((c) => !excludeIds.has(c.id));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t("title")}</h1>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="mr-2 h-4 w-4" />
          {t("addButton")}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <form onSubmit={handleSearch} className="flex flex-1 gap-2">
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

        <Select value={parentFilter} onValueChange={setParentFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={t("filterPlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allCategories")}</SelectItem>
            <SelectItem value="root">{t("rootCategories")}</SelectItem>
            {allCategories
              .filter((c) => !c.parentId)
              .map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("headers.name")}</TableHead>
              <TableHead>{t("headers.parent")}</TableHead>
              <TableHead className="text-center">{t("headers.products")}</TableHead>
              <TableHead className="text-center">{t("headers.subcategories")}</TableHead>
              <TableHead className="text-center">{t("headers.order")}</TableHead>
              <TableHead className="text-center">{t("headers.status")}</TableHead>
              <TableHead className="w-[70px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <div className="bg-muted h-5 w-32 animate-pulse rounded" />
                  </TableCell>
                  <TableCell>
                    <div className="bg-muted h-5 w-24 animate-pulse rounded" />
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="bg-muted mx-auto h-5 w-8 animate-pulse rounded" />
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="bg-muted mx-auto h-5 w-8 animate-pulse rounded" />
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="bg-muted mx-auto h-5 w-8 animate-pulse rounded" />
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="bg-muted mx-auto h-5 w-16 animate-pulse rounded" />
                  </TableCell>
                  <TableCell></TableCell>
                </TableRow>
              ))
            ) : categories.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center">
                  <div className="flex flex-col items-center justify-center">
                    <FolderTree className="text-muted-foreground h-10 w-10" />
                    <p className="text-muted-foreground mt-2 text-sm">{t("empty")}</p>
                    <Button variant="outline" className="mt-4" onClick={openCreateDialog}>
                      <Plus className="mr-2 h-4 w-4" />
                      {t("createFirstButton")}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              categories.map((category) => (
                <TableRow key={category.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      {category.image ? (
                        <Image
                          src={category.image}
                          alt={category.name}
                          width={40}
                          height={40}
                          className="h-10 w-10 rounded-md object-cover"
                        />
                      ) : (
                        <div className="bg-muted flex h-10 w-10 items-center justify-center rounded-md">
                          <FolderTree className="text-muted-foreground h-5 w-5" />
                        </div>
                      )}
                      <div>
                        <p className="font-medium">{category.name}</p>
                        <p className="text-muted-foreground text-sm">/{category.slug}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {category.parent ? (
                      <div className="flex items-center gap-1 text-sm">
                        <ChevronRight className="h-3 w-3" />
                        {category.parent.name}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Package className="text-muted-foreground h-3 w-3" />
                      {category._count.products}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <FolderTree className="text-muted-foreground h-3 w-3" />
                      {category._count.children}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">{category.sortOrder}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant={category.isActive ? "default" : "secondary"}>
                      {category.isActive ? t("status.active") : t("status.inactive")}
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
                        <DropdownMenuItem onClick={() => openEditDialog(category)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          {tCommon("edit")}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => openDeleteDialog(category)}
                          className="text-red-600"
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

      {/* Create/Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {selectedCategory ? t("form.editTitle") : t("form.createTitle")}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t("form.nameLabel")}</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => {
                  const name = e.target.value;
                  setFormData((prev) => ({
                    ...prev,
                    name,
                    slug: slugEdited ? prev.slug : generateSlug(name),
                  }));
                }}
                placeholder={t("form.namePlaceholder")}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug">{t("form.slugLabel")}</Label>
              <Input
                id="slug"
                value={formData.slug}
                onChange={(e) => {
                  setSlugEdited(true);
                  setFormData((prev) => ({ ...prev, slug: e.target.value }));
                }}
                placeholder="category-slug"
              />
              <p className="text-muted-foreground text-xs">{t("form.slugHint")}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">{t("form.descriptionLabel")}</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                placeholder={t("form.descriptionPlaceholder")}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="image">{t("form.imageLabel")}</Label>
              <Input
                id="image"
                type="url"
                value={formData.image}
                onChange={(e) => setFormData((prev) => ({ ...prev, image: e.target.value }))}
                placeholder="https://example.com/image.jpg"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="parent">{t("form.parentLabel")}</Label>
              <Select
                value={formData.parentId || "none"}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, parentId: value === "none" ? "" : value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("form.noneRootCategory")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("form.noneRootCategory")}</SelectItem>
                  {getAvailableParents().map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sortOrder">{t("form.sortOrderLabel")}</Label>
              <Input
                id="sortOrder"
                type="number"
                min="0"
                value={formData.sortOrder}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, sortOrder: parseInt(e.target.value) || 0 }))
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="isActive">{t("form.activeLabel")}</Label>
              <Switch
                id="isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({ ...prev, isActive: checked }))
                }
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>
                {tCommon("cancel")}
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting
                  ? t("form.saving")
                  : selectedCategory
                    ? t("form.update")
                    : tCommon("create")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteDialog.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteDialog.confirmText", { name: selectedCategory?.name ?? "" })}
              {selectedCategory && selectedCategory._count.products > 0 && (
                <span className="text-destructive mt-2 block">
                  {t("deleteDialog.hasProductsWarning", {
                    count: selectedCategory._count.products,
                  })}
                </span>
              )}
              {selectedCategory && selectedCategory._count.children > 0 && (
                <span className="text-destructive mt-2 block">
                  {t("deleteDialog.hasChildrenWarning", {
                    count: selectedCategory._count.children,
                  })}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={
                isSubmitting ||
                !!(
                  selectedCategory &&
                  (selectedCategory._count.products > 0 || selectedCategory._count.children > 0)
                )
              }
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isSubmitting ? t("deleteDialog.deleting") : tCommon("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
