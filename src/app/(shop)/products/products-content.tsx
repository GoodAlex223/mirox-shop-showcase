"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Package } from "lucide-react";
import { ProductCard, QuickViewDialog } from "@/components/products";
import { trackViewItemList, trackSelectItem, type GA4Item } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import {
  FilterBar,
  type CatalogFilters,
  type CatalogSort,
  type CategoryFacetGroup,
} from "./filter-bar";

interface Product {
  id: string;
  name: string;
  slug: string;
  shortDesc: string | null;
  price: string;
  comparePrice: string | null;
  stock: number;
  isFeatured: boolean;
  createdAt: string;
  category: { id: string; name: string; slug: string };
  images: { url: string; alt: string | null }[];
  variants: { id: string; name: string; value: string; stock: number; price: string | null }[];
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

/**
 * Parses a minPrice/maxPrice query param into a finite number, or null.
 * `Number("")` is 0 and `Number("abc")` is NaN — a malformed/garbage URL
 * (hand-edited, or a stale bookmark) must not feed NaN into the price
 * slider's `[minPrice ?? 0, maxPrice ?? PRICE_MAX]` range (final-review
 * Fix 3): `Number.isFinite` rejects NaN and ±Infinity alike, falling back to
 * null (== "no filter") for anything that isn't a real number.
 */
function parseNumericParam(value: string | null): number | null {
  if (!value) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

/**
 * All page numbers when there are 7 or fewer; otherwise the first and last
 * page plus a window of `current ± 2`, with an "ellipsis" marker filling any
 * gap so the sequence never looks like it skipped pages silently.
 */
function getPageNumbers(current: number, total: number): (number | "ellipsis")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages = new Set<number>([1, total]);
  for (let p = current - 2; p <= current + 2; p++) {
    if (p >= 1 && p <= total) pages.add(p);
  }

  const sorted = Array.from(pages).sort((a, b) => a - b);
  const result: (number | "ellipsis")[] = [];
  let prev = 0;
  for (const p of sorted) {
    if (prev && p - prev > 1) result.push("ellipsis");
    result.push(p);
    prev = p;
  }
  return result;
}

function ProductsContentInner() {
  const t = useTranslations("products");
  const router = useRouter();
  const searchParams = useSearchParams();

  const [products, setProducts] = useState<Product[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  const [categories, setCategories] = useState<CategoryFacetGroup[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 12,
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [quickView, setQuickView] = useState<{ product: Product; focusSizes: boolean } | null>(
    null
  );

  const fetchProducts = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", searchParams?.get("page") || "1");
      params.set("limit", "12");

      // Legacy sortBy/sortOrder are forwarded only when present in the URL
      // (old links keep working); `sort` is the current param and the API
      // defaults it to "new" on its own, so we don't always set it here.
      const forward = (key: string) => {
        const value = searchParams?.get(key);
        if (value) params.set(key, value);
      };
      forward("search");
      forward("category");
      forward("featured");
      forward("minPrice");
      forward("maxPrice");
      forward("size");
      forward("color");
      forward("brand");
      forward("inStock");
      forward("sort");
      forward("sortBy");
      forward("sortOrder");

      const response = await fetch(`/api/products?${params}`);
      if (!response.ok) throw new Error("Failed to fetch products");

      const data: PaginatedResponse = await response.json();
      setProducts(data.data);
      setPagination(data.pagination);
    } catch (error) {
      console.error("Error fetching products:", error);
    } finally {
      setIsLoading(false);
    }
  }, [searchParams]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    async function fetchBrands() {
      try {
        const response = await fetch("/api/products/brands");
        if (!response.ok) throw new Error("Failed to fetch brands");
        const data = await response.json();
        setBrands(data);
      } catch {
        setBrands([]);
      }
    }
    fetchBrands();
  }, []);

  useEffect(() => {
    async function fetchCategories() {
      try {
        const response = await fetch("/api/categories?parentOnly=true");
        if (!response.ok) throw new Error("Failed to fetch categories");
        const data = await response.json();
        setCategories(data);
      } catch {
        setCategories([]);
      }
    }
    fetchCategories();
  }, []);

  // GA4: Track product list view (once per product set)
  const listTracked = useRef(false);
  useEffect(() => {
    listTracked.current = false;
  }, [searchParams]);
  useEffect(() => {
    if (products.length > 0 && !isLoading && !listTracked.current) {
      listTracked.current = true;
      const categorySlug = searchParams?.get("category");
      const ga4Items: GA4Item[] = products.map((p, index) => ({
        item_id: p.id,
        item_name: p.name,
        item_category: p.category?.name,
        price: parseFloat(p.price),
        quantity: 1,
        index,
      }));
      trackViewItemList(
        ga4Items,
        categorySlug || "all_products",
        categorySlug ? `Category: ${categorySlug}` : "All Products"
      );
    }
  }, [products, isLoading, searchParams]);

  const updateFilters = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams?.toString() || "");
    params.set("page", "1"); // Reset to first page on filter change

    Object.entries(updates).forEach(([key, value]) => {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    });

    router.push(`/products?${params}`);
  };

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams?.toString() || "");
    params.set("page", newPage.toString());
    router.push(`/products?${params}`);
  };

  const clearFilters = () => {
    router.push("/products");
  };

  const rawSort = searchParams?.get("sort");
  const sort: CatalogSort =
    rawSort === "popular" || rawSort === "price-asc" || rawSort === "price-desc" ? rawSort : "new";

  const filters: CatalogFilters = {
    size: searchParams?.get("size") || null,
    color: searchParams?.get("color") || null,
    brand: searchParams?.get("brand") || null,
    inStock: searchParams?.get("inStock") === "true",
    minPrice: parseNumericParam(searchParams?.get("minPrice") ?? null),
    maxPrice: parseNumericParam(searchParams?.get("maxPrice") ?? null),
    search: searchParams?.get("search") || null,
    category: searchParams?.get("category") || null,
    sort,
  };

  return (
    <div className="container py-10">
      {/* Header */}
      <div className="mb-2.5 text-[12.5px] text-[#737373]">
        <Link href="/" className="hover:text-white">
          {t("breadcrumbHome")}
        </Link>{" "}
        / <span className="text-[#a3a3a3]">{t("catalogName")}</span>
      </div>
      <h1 className="mb-7 text-[40px] font-extrabold tracking-[-0.02em]">{t("catalogName")}</h1>

      <FilterBar
        filters={filters}
        brands={brands}
        categories={categories}
        onChange={updateFilters}
        onClearAll={clearFilters}
      />

      {/* Products Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-[repeat(auto-fill,minmax(240px,1fr))] md:gap-5">
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="overflow-hidden rounded-2xl border border-[#1a1a1a] bg-[#0d0d0d]"
            >
              <div className="aspect-square animate-pulse bg-[#1a1a1a]" />
              <div className="space-y-2 p-4">
                <div className="h-4 w-3/4 animate-pulse rounded bg-[#1a1a1a]" />
                <div className="h-3 w-1/2 animate-pulse rounded bg-[#1a1a1a]" />
                <div className="h-5 w-1/3 animate-pulse rounded bg-[#1a1a1a]" />
              </div>
            </div>
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Package className="h-12 w-12 text-[#525252]" />
          <h2 className="mt-4 text-lg font-bold">{t("list.empty.title")}</h2>
          <p className="mt-2 text-sm text-[#a3a3a3]">{t("list.empty.description")}</p>
          <button
            type="button"
            onClick={clearFilters}
            className="mt-6 rounded-[10px] border border-[#333] px-5 py-2.5 text-[13px] font-bold"
          >
            {t("list.empty.clearFilters")}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-[repeat(auto-fill,minmax(240px,1fr))] md:gap-5">
          {products.map((product, index) => (
            <div
              key={product.id}
              onClick={() =>
                trackSelectItem(
                  {
                    item_id: product.id,
                    item_name: product.name,
                    item_category: product.category?.name,
                    price: parseFloat(product.price),
                    quantity: 1,
                    index,
                  },
                  searchParams?.get("category") || "all_products",
                  searchParams?.get("category")
                    ? `Category: ${searchParams.get("category")}`
                    : "All Products"
                )
              }
            >
              <ProductCard
                product={product}
                onQuickView={(opts) => setQuickView({ product, focusSizes: opts.focusSizes })}
              />
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="mt-10 flex items-center justify-center gap-2 text-[13.5px] font-bold text-[#a3a3a3]">
          {pagination.hasPrev && (
            <button
              type="button"
              aria-label={t("list.pagination.prev")}
              onClick={() => handlePageChange(pagination.page - 1)}
              className="flex h-9 w-9 items-center justify-center rounded-[9px] border border-[#262626] transition-colors hover:border-[#666] hover:text-white"
            >
              ←
            </button>
          )}
          {getPageNumbers(pagination.page, pagination.totalPages).map((p, i) =>
            p === "ellipsis" ? (
              <span
                key={`ellipsis-${i}`}
                className="flex h-9 w-9 items-center justify-center"
                aria-hidden="true"
              >
                …
              </span>
            ) : (
              <button
                key={p}
                type="button"
                aria-current={p === pagination.page ? "page" : undefined}
                onClick={() => handlePageChange(p)}
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-[9px] border transition-colors",
                  p === pagination.page
                    ? "border-[#333] bg-white text-black"
                    : "border-[#262626] text-[#a3a3a3] hover:border-[#666] hover:text-white"
                )}
              >
                {p}
              </button>
            )
          )}
          {pagination.hasNext && (
            <button
              type="button"
              aria-label={t("list.pagination.next")}
              onClick={() => handlePageChange(pagination.page + 1)}
              className="flex h-9 w-9 items-center justify-center rounded-[9px] border border-[#262626] transition-colors hover:border-[#666] hover:text-white"
            >
              →
            </button>
          )}
        </div>
      )}

      <QuickViewDialog
        product={quickView?.product ?? null}
        focusSizes={quickView?.focusSizes ?? false}
        onOpenChange={(open) => !open && setQuickView(null)}
      />
    </div>
  );
}

function ProductsLoadingSkeleton() {
  return (
    <div className="container py-10">
      <div className="mb-2.5 h-3 w-24 animate-pulse rounded bg-[#1a1a1a]" />
      <div className="mb-7 h-10 w-56 animate-pulse rounded bg-[#1a1a1a]" />
      <div className="mb-8 flex gap-2.5">
        <div className="h-10 w-24 animate-pulse rounded-[10px] bg-[#1a1a1a]" />
        <div className="h-10 w-24 animate-pulse rounded-[10px] bg-[#1a1a1a]" />
        <div className="h-10 w-40 animate-pulse rounded-[10px] bg-[#1a1a1a]" />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-[repeat(auto-fill,minmax(240px,1fr))] md:gap-5">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="overflow-hidden rounded-2xl border border-[#1a1a1a] bg-[#0d0d0d]">
            <div className="aspect-square animate-pulse bg-[#1a1a1a]" />
            <div className="space-y-2 p-4">
              <div className="h-4 w-3/4 animate-pulse rounded bg-[#1a1a1a]" />
              <div className="h-5 w-1/3 animate-pulse rounded bg-[#1a1a1a]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ProductsContent() {
  return (
    <Suspense fallback={<ProductsLoadingSkeleton />}>
      <ProductsContentInner />
    </Suspense>
  );
}
