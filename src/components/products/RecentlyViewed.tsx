"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ProductCard } from "./ProductCard";

const STORAGE_KEY = "mirox:recently-viewed";
const MAX_ENTRIES = 8;

/** Product shape as returned by /api/products (LIST_SELECT) — passed through to ProductCard. */
interface RecentProduct {
  id: string;
  name: string;
  slug: string;
  shortDesc?: string | null;
  price: string;
  comparePrice?: string | null;
  stock: number;
  isFeatured?: boolean;
  createdAt?: string;
  category?: { name: string; slug: string };
  images: { url: string; alt?: string | null }[];
  variants?: { name: string; value: string }[];
}

export function readRecentlyViewed(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

export function recordRecentlyViewed(id: string): void {
  try {
    const next = [id, ...readRecentlyViewed().filter((v) => v !== id)].slice(0, MAX_ENTRIES);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage unavailable (private mode/quota) — the section just won't build history.
  }
}

/**
 * "Recently viewed" — pure client section (nothing server-rendered,
 * so no hydration risk): records the current PDP into localStorage on mount,
 * then fetches the OTHER recorded products fresh from /api/products?ids=…
 * (isActive enforced server-side, so dead history self-heals). Any failure
 * renders nothing — the section is never load-bearing.
 */
export function RecentlyViewed({ currentProductId }: { currentProductId: string }) {
  const t = useTranslations("products");
  const [products, setProducts] = useState<RecentProduct[]>([]);

  useEffect(() => {
    const previous = readRecentlyViewed().filter((id) => id !== currentProductId);
    recordRecentlyViewed(currentProductId);
    if (previous.length === 0) return;

    let cancelled = false;
    fetch(`/api/products?ids=${previous.join(",")}&limit=12`)
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        if (cancelled || !body?.data) return;
        // Preserve recency order — the API returns DB order.
        const byId = new Map((body.data as RecentProduct[]).map((p) => [p.id, p]));
        setProducts(previous.map((id) => byId.get(id)).filter((p): p is RecentProduct => !!p));
      })
      .catch(() => {
        // Fail-soft: section stays hidden.
      });
    return () => {
      cancelled = true;
    };
  }, [currentProductId]);

  if (products.length === 0) return null;

  return (
    <section aria-label={t("recentlyViewed.title")} className="mt-16">
      <h2 className="mb-7 text-[28px] font-extrabold tracking-[-0.02em]">
        {t("recentlyViewed.title")}
      </h2>
      <div className="grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-3 lg:grid-cols-4">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  );
}
