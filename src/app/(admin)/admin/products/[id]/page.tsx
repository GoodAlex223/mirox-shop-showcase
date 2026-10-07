"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProductForm, ProductImagesSection, ProductVariantsSection } from "@/components/admin";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

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

export default function EditProductPage() {
  const t = useTranslations("admin.products");
  // non-null: the pages-compat types in next-env.d.ts make useParams() nullable; App Router always supplies params
  const { id } = useParams<{ id: string }>()!;
  const [product, setProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const response = await fetch(`/api/admin/products/${id}`);
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error(t("notFound"));
          }
          throw new Error(t("loadFailed"));
        }
        const data = await response.json();
        setProduct(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : t("loadFailed"));
        toast.error(t("loadFailed"));
      } finally {
        setIsLoading(false);
      }
    };

    fetchProduct();
  }, [id, t]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <div className="bg-muted h-10 w-10 rounded" />
          <div>
            <div className="bg-muted h-8 w-48 rounded" />
            <div className="bg-muted mt-2 h-4 w-32 rounded" />
          </div>
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <div className="bg-muted/20 h-[400px] rounded-lg border" />
          </div>
          <div className="bg-muted/20 h-[300px] rounded-lg border" />
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <h2 className="text-xl font-semibold">{t("notFound")}</h2>
        <p className="text-muted-foreground mt-2">{error}</p>
        <Link href="/admin/products" className="mt-4">
          <Button>{t("backToProducts")}</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/products">
          <Button variant="ghost" size="icon">
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{t("editTitle")}</h2>
          <p className="text-muted-foreground">{product.name}</p>
        </div>
      </div>

      <ProductForm product={product} isEdit />
      <ProductImagesSection productId={product.id} />
      <ProductVariantsSection productId={product.id} />
    </div>
  );
}
