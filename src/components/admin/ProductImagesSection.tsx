"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ImageUploader } from "./ImageUploader";
import { diffImages, type AdminImage } from "./image-diff";

interface ProductImagesSectionProps {
  productId: string;
}

/**
 * G16: the persistence wrapper ImageUploader never had. Adds POST, removals
 * DELETE, both immediately; reorders apply locally and persist on an explicit
 * button (the uploader emits onChange per drag-over). Removing a persisted
 * image deletes the DB row only — the R2 object is left in place (accepted).
 */
export function ProductImagesSection({ productId }: ProductImagesSectionProps) {
  const t = useTranslations("admin.productImages");
  const tCommon = useTranslations("admin.common");
  const base = `/api/admin/products/${productId}/images`;

  const [images, setImages] = useState<AdminImage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [orderDirty, setOrderDirty] = useState(false);
  const [isSavingOrder, setIsSavingOrder] = useState(false);

  // I6/G16 fix: the initial-fetch effect below must not depend on `t`.
  // useTranslations' return is memoised today so there's no loop right now,
  // but that's exactly the shape of the G13 use-toast loop bug — if the
  // provider's messages identity ever churns, this effect would refetch in
  // a loop. The ref gives the catch branch a current translator without the
  // effect depending on its identity.
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  }, [t]);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(base);
        if (!res.ok) throw new Error();
        const rows: { id: string; url: string; alt: string | null }[] = await res.json();
        setImages(rows.map((r) => ({ id: r.id, url: r.url, alt: r.alt ?? undefined })));
      } catch {
        toast.error(tRef.current("toasts.loadError"));
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [base]);

  const handleChange = async (next: AdminImage[]) => {
    const { added, removedIds, orderChanged } = diffImages(images, next);

    if (orderChanged) {
      setImages(next);
      setOrderDirty(true);
      return;
    }

    // Optimistic local state; failures below roll the specific item back.
    let working = next;
    setImages(working);

    for (const id of removedIds) {
      try {
        const res = await fetch(`${base}/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error();
      } catch {
        toast.error(t("toasts.removeError"));
        const restored = images.find((i) => i.id === id);
        if (restored) {
          working = [...working, restored];
          setImages(working);
        }
      }
    }

    for (const item of added) {
      try {
        // I1/G16 fix: no `position` here. `working.indexOf(item)` is an
        // index into the *currently visible* list, which collides with
        // whatever position a surviving row already holds server-side (e.g.
        // remove image 0, upload a replacement — indexOf gives 1, which i2
        // already occupies there). Two rows sharing a position makes
        // "first" (the product-card/OG image) arbitrary until the next
        // reload. The route already assigns max+1 when position is
        // omitted, which is always collision-free; ordering is then
        // explicitly owned by the reorder-and-save flow, which is the
        // design's intent anyway.
        const res = await fetch(base, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: item.url }),
        });
        if (!res.ok) throw new Error();
        const row: { id: string; url: string; alt: string | null } = await res.json();
        working = working.map((i) =>
          i === item ? { id: row.id, url: row.url, alt: row.alt ?? undefined } : i
        );
      } catch {
        toast.error(t("toasts.attachError", { name: item.url.split("/").pop() ?? item.url }));
        working = working.filter((i) => i !== item);
      }
      setImages(working);
    }
  };

  const saveOrder = async () => {
    setIsSavingOrder(true);
    try {
      const res = await fetch(base, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageIds: images.filter((i) => i.id).map((i) => i.id) }),
      });
      if (!res.ok) throw new Error();
      setOrderDirty(false);
      toast.success(t("orderSaved"));
    } catch {
      toast.error(t("toasts.orderError"));
    } finally {
      setIsSavingOrder(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" /> {tCommon("loading")}
          </div>
        ) : (
          <ImageUploader images={images} onChange={handleChange} maxImages={12} folder="products" />
        )}
        {orderDirty && (
          <Button type="button" onClick={saveOrder} disabled={isSavingOrder}>
            {isSavingOrder && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t("saveOrder")}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
