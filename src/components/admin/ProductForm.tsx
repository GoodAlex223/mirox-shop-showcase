"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { generateSlug } from "@/lib/slug";

type TProductForm = ReturnType<typeof useTranslations<"admin.productForm">>;

function buildProductFormSchema(t: TProductForm) {
  return z
    .object({
      name: z.string().min(1, t("errors.nameRequired")).max(255),
      slug: z.string().max(255).optional(),
      description: z.string().optional(),
      shortDesc: z.string().max(500).optional(),
      // These mirror productBaseSchema on the server, which answers a field-less
      // VALIDATION_ERROR: anything it rejects must be caught here, under its field
      // (G24 review). comparePrice needs no own check — the refine below demands
      // more than a price that is already > 0.
      price: z.string().refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0, {
        message: t("errors.pricePositive"),
      }),
      comparePrice: z.string().optional(),
      costPrice: z
        .string()
        .optional()
        .refine((val) => !val || (!isNaN(parseFloat(val)) && parseFloat(val) > 0), {
          message: t("errors.costPricePositive"),
        }),
      sku: z.string().min(1, t("errors.skuRequired")),
      barcode: z.string().max(14, t("errors.barcodeTooLong")).optional(),
      brand: z.string().max(70, t("errors.brandTooLong")).optional(),
      mpn: z.string().max(70, t("errors.mpnTooLong")).optional(),
      styleGroup: z.string().max(100, t("errors.styleGroupTooLong")).optional(),
      stock: z.string().refine((val) => !isNaN(parseInt(val)) && parseInt(val) >= 0, {
        message: t("errors.stockNonNegative"),
      }),
      categoryId: z.string().min(1, t("errors.categoryRequired")),
      isActive: z.boolean(),
      isFeatured: z.boolean(),
      excludeFromFeed: z.boolean(),
    })
    .refine(
      (data) => {
        if (!data.comparePrice) return true;
        const compare = parseFloat(data.comparePrice);
        const price = parseFloat(data.price);
        return isNaN(compare) || isNaN(price) || compare > price;
      },
      {
        message: t("errors.comparePriceGreater"),
        path: ["comparePrice"],
      }
    );
}

type ProductFormData = z.infer<ReturnType<typeof buildProductFormSchema>>;

interface Category {
  id: string;
  name: string;
  parentId: string | null;
}

interface Product {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  shortDesc: string | null;
  price: string;
  comparePrice: string | null;
  costPrice: string | null;
  sku: string;
  barcode: string | null;
  brand: string | null;
  mpn: string | null;
  styleGroup: string | null;
  stock: number;
  categoryId: string;
  isActive: boolean;
  isFeatured: boolean;
  excludeFromFeed: boolean;
}

interface ProductFormProps {
  product?: Product;
  isEdit?: boolean;
}

export function ProductForm({ product, isEdit = false }: ProductFormProps) {
  const router = useRouter();
  const t = useTranslations("admin.productForm");
  const tCommon = useTranslations("admin.common");
  const productFormSchema = useMemo(() => buildProductFormSchema(t), [t]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingCategories, setIsFetchingCategories] = useState(true);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ProductFormData>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      name: product?.name || "",
      slug: product?.slug || "",
      description: product?.description || "",
      shortDesc: product?.shortDesc || "",
      price: product?.price || "",
      comparePrice: product?.comparePrice || "",
      costPrice: product?.costPrice || "",
      sku: product?.sku || "",
      barcode: product?.barcode || "",
      brand: product?.brand || "",
      mpn: product?.mpn || "",
      styleGroup: product?.styleGroup || "",
      stock: product?.stock?.toString() || "0",
      categoryId: product?.categoryId || "",
      isActive: product?.isActive ?? true,
      isFeatured: product?.isFeatured ?? false,
      // G24: every product this shop sells is third-party branded, so a new one
      // starts excluded from the Google Shopping feed — the safe default for a
      // whole-account suspension risk. Deliberately the form, not the Zod schema
      // (a .default() there would reset the flag on every partial PUT) or the
      // DB default. An edited product shows what is stored.
      excludeFromFeed: product?.excludeFromFeed ?? true,
    },
  });

  const isActive = watch("isActive");
  const isFeatured = watch("isFeatured");
  const excludeFromFeed = watch("excludeFromFeed");
  const categoryId = watch("categoryId");

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await fetch("/api/admin/categories?all=true");
        if (!response.ok) throw new Error("Failed to fetch categories");
        const data = await response.json();
        setCategories(data);
      } catch (error) {
        console.error("Error fetching categories:", error);
        toast.error(t("toasts.loadCategoriesError"));
      } finally {
        setIsFetchingCategories(false);
      }
    };

    fetchCategories();
  }, [t]);

  // The API answers with English `error` prose (log text) plus a machine
  // `code`. This admin is UA-catalog-driven, so the toast shows the catalog's
  // copy for the code and never `error` itself; an absent or unknown code
  // falls back to the generic save error (the ProductVariantsSection pattern).
  const errorMessageForCode = (code?: string) => {
    const key = code ? `byCode.${code}` : "";
    return key && t.has(key as never) ? t(key as never) : t("toasts.saveError");
  };

  const onSubmit = async (data: ProductFormData) => {
    setIsLoading(true);

    try {
      const payload = {
        name: data.name,
        slug: data.slug || undefined,
        description: data.description || undefined,
        shortDesc: data.shortDesc || undefined,
        price: parseFloat(data.price),
        comparePrice: data.comparePrice ? parseFloat(data.comparePrice) : null,
        costPrice: data.costPrice ? parseFloat(data.costPrice) : null,
        sku: data.sku,
        barcode: data.barcode || null,
        brand: data.brand || null,
        mpn: data.mpn || null,
        styleGroup: data.styleGroup || null,
        stock: parseInt(data.stock),
        categoryId: data.categoryId,
        isActive: data.isActive,
        isFeatured: data.isFeatured,
        excludeFromFeed: data.excludeFromFeed,
      };

      const url = isEdit ? `/api/admin/products/${product?.id}` : "/api/admin/products";
      const method = isEdit ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        toast.error(errorMessageForCode(errorData?.code));
        return;
      }

      const savedProduct = await response.json();
      toast.success(isEdit ? t("toasts.updateSuccess") : t("toasts.createSuccess"));
      router.push(`/admin/products/${savedProduct.id}`);
      router.refresh();
    } catch (error) {
      console.error("Error saving product:", error);
      toast.error(t("toasts.saveError"));
    } finally {
      setIsLoading(false);
    }
  };

  const fillSlugFromName = () => {
    const name = watch("name");
    if (name) {
      setValue("slug", generateSlug(name));
    }
  };

  const generateSku = () => {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    setValue("sku", `SKU-${timestamp}-${random}`);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>{t("cardTitles.basicInfo")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">{t("labels.name")}</Label>
                <Input
                  id="name"
                  {...register("name")}
                  placeholder={t("placeholders.name")}
                  disabled={isLoading}
                />
                {errors.name && <p className="text-destructive text-sm">{errors.name.message}</p>}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="slug">{t("labels.slug")}</Label>
                  <Button type="button" variant="ghost" size="sm" onClick={fillSlugFromName}>
                    {t("generateFromName")}
                  </Button>
                </div>
                <Input
                  id="slug"
                  {...register("slug")}
                  placeholder={t("placeholders.slug")}
                  disabled={isLoading}
                />
                {errors.slug ? (
                  <p className="text-destructive text-sm">{errors.slug.message}</p>
                ) : (
                  <p className="text-muted-foreground text-xs">{t("hints.slug")}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="shortDesc">{t("labels.shortDesc")}</Label>
                <Textarea
                  id="shortDesc"
                  {...register("shortDesc")}
                  placeholder={t("placeholders.shortDesc")}
                  rows={2}
                  disabled={isLoading}
                />
                {errors.shortDesc && (
                  <p className="text-destructive text-sm">{errors.shortDesc.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">{t("labels.description")}</Label>
                <Textarea
                  id="description"
                  {...register("description")}
                  placeholder={t("placeholders.description")}
                  rows={6}
                  disabled={isLoading}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("cardTitles.pricing")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="price">{t("labels.price")}</Label>
                  <div className="relative">
                    <span className="text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2">
                      грн
                    </span>
                    <Input
                      id="price"
                      type="number"
                      step="0.01"
                      min="0"
                      {...register("price")}
                      className="pl-12"
                      placeholder={t("placeholders.amount")}
                      disabled={isLoading}
                    />
                  </div>
                  {errors.price && (
                    <p className="text-destructive text-sm">{errors.price.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="comparePrice">{t("labels.comparePrice")}</Label>
                  <div className="relative">
                    <span className="text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2">
                      грн
                    </span>
                    <Input
                      id="comparePrice"
                      type="number"
                      step="0.01"
                      min="0"
                      {...register("comparePrice")}
                      className="pl-12"
                      placeholder={t("placeholders.amount")}
                      disabled={isLoading}
                    />
                  </div>
                  {errors.comparePrice ? (
                    <p className="text-destructive text-sm">{errors.comparePrice.message}</p>
                  ) : (
                    <p className="text-muted-foreground text-xs">{t("hints.comparePrice")}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="costPrice">{t("labels.costPrice")}</Label>
                  <div className="relative">
                    <span className="text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2">
                      грн
                    </span>
                    <Input
                      id="costPrice"
                      type="number"
                      step="0.01"
                      min="0"
                      {...register("costPrice")}
                      className="pl-12"
                      placeholder={t("placeholders.amount")}
                      disabled={isLoading}
                    />
                  </div>
                  {errors.costPrice ? (
                    <p className="text-destructive text-sm">{errors.costPrice.message}</p>
                  ) : (
                    <p className="text-muted-foreground text-xs">{t("hints.costPrice")}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("cardTitles.inventory")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="sku">{t("labels.sku")}</Label>
                    <Button type="button" variant="ghost" size="sm" onClick={generateSku}>
                      {t("generateSku")}
                    </Button>
                  </div>
                  <Input
                    id="sku"
                    {...register("sku")}
                    placeholder={t("placeholders.sku")}
                    disabled={isLoading}
                  />
                  {errors.sku && <p className="text-destructive text-sm">{errors.sku.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="stock">{t("labels.stock")}</Label>
                  <Input
                    id="stock"
                    type="number"
                    min="0"
                    {...register("stock")}
                    placeholder={t("placeholders.stock")}
                    disabled={isLoading}
                  />
                  {errors.stock && (
                    <p className="text-destructive text-sm">{errors.stock.message}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("cardTitles.identifiers")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground text-sm">{t("hints.identifiers")}</p>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="brand">{t("labels.brand")}</Label>
                  <Input
                    id="brand"
                    {...register("brand")}
                    placeholder={t("placeholders.brand")}
                    disabled={isLoading}
                  />
                  {errors.brand && (
                    <p className="text-destructive text-sm">{errors.brand.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="barcode">{t("labels.barcode")}</Label>
                  <Input
                    id="barcode"
                    {...register("barcode")}
                    placeholder={t("placeholders.barcode")}
                    disabled={isLoading}
                  />
                  {errors.barcode ? (
                    <p className="text-destructive text-sm">{errors.barcode.message}</p>
                  ) : (
                    <p className="text-muted-foreground text-xs">{t("hints.barcode")}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mpn">{t("labels.mpn")}</Label>
                  <Input
                    id="mpn"
                    {...register("mpn")}
                    placeholder={t("placeholders.mpn")}
                    disabled={isLoading}
                  />
                  {errors.mpn && <p className="text-destructive text-sm">{errors.mpn.message}</p>}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t("cardTitles.status")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="isActive">{t("labels.active")}</Label>
                  <p className="text-muted-foreground text-sm">{t("hints.active")}</p>
                </div>
                <Switch
                  id="isActive"
                  checked={isActive}
                  onCheckedChange={(checked) => setValue("isActive", checked)}
                  disabled={isLoading}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="isFeatured">{t("labels.featured")}</Label>
                  <p className="text-muted-foreground text-sm">{t("hints.featured")}</p>
                </div>
                <Switch
                  id="isFeatured"
                  checked={isFeatured}
                  onCheckedChange={(checked) => setValue("isFeatured", checked)}
                  disabled={isLoading}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label htmlFor="excludeFromFeed">{t("labels.excludeFromFeed")}</Label>
                  <p className="text-muted-foreground text-sm">{t("hints.excludeFromFeed")}</p>
                </div>
                <Switch
                  id="excludeFromFeed"
                  checked={excludeFromFeed}
                  onCheckedChange={(checked) => setValue("excludeFromFeed", checked)}
                  disabled={isLoading}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("cardTitles.organization")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="categoryId">{t("labels.category")}</Label>
                <Select
                  value={categoryId}
                  onValueChange={(value) => setValue("categoryId", value)}
                  disabled={isLoading || isFetchingCategories}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        isFetchingCategories ? tCommon("loading") : t("placeholders.category")
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.categoryId && (
                  <p className="text-destructive text-sm">{errors.categoryId.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="styleGroup">{t("labels.styleGroup")}</Label>
                <Input
                  id="styleGroup"
                  {...register("styleGroup")}
                  placeholder={t("placeholders.styleGroup")}
                  disabled={isLoading}
                />
                <p className="text-muted-foreground text-xs">{t("hints.styleGroup")}</p>
                {errors.styleGroup && (
                  <p className="text-destructive text-sm">{errors.styleGroup.message}</p>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-col gap-2">
            <Button type="submit" disabled={isLoading} className="w-full">
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? t("submitUpdate") : t("submitCreate")}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/admin/products")}
              disabled={isLoading}
              className="w-full"
            >
              {tCommon("cancel")}
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}
