"use client";

import { useState, useEffect, FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

// Guest order lookup (G18 spec §4). Mirrors feedback-form.tsx: coded outcomes
// map to catalog copy through the t.has guard; success navigates to the
// grant-gated status page. No honeypot — the route creates nothing and has
// its own per-order lockout.
export function TrackForm() {
  const t = useTranslations("track");
  const router = useRouter();
  const searchParams = useSearchParams();
  const [orderNumber, setOrderNumber] = useState(searchParams?.get("order") ?? "");
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // E2E hydration signal (WebKit lesson, product-detail-client.tsx
  // precedent): fields render in the SSR HTML, so a fill() before React
  // hydrates silently drops on WebKit. Tests wait for [data-hydrated="true"].
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    try {
      const response = await fetch("/api/orders/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderNumber, email }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        // data.error is EN API/log text — map the machine code instead.
        const code = data.code as string | undefined;
        const key = code ? `byCode.${code}` : "";
        const minutes = Math.max(1, Math.ceil((Number(data.retryAfterSeconds) || 900) / 60));
        toast.error(
          key && t.has(key as never) ? t(key as never, { minutes } as never) : t("fallback")
        );
        return;
      }

      router.push(`/track/${encodeURIComponent(String(data.orderNumber))}`);
    } catch {
      toast.error(t("fallback"));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4"
      data-hydrated={hydrated ? "true" : undefined}
    >
      <div className="space-y-1.5">
        <label htmlFor="track-order-number" className="text-sm font-medium">
          {t("form.orderNumberLabel")}
        </label>
        <Input
          id="track-order-number"
          value={orderNumber}
          required
          maxLength={40}
          autoComplete="off"
          placeholder={t("form.orderNumberPlaceholder")}
          onChange={(e) => setOrderNumber(e.target.value)}
          disabled={isLoading}
        />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="track-email" className="text-sm font-medium">
          {t("form.emailLabel")}
        </label>
        <Input
          id="track-email"
          type="email"
          value={email}
          required
          maxLength={254}
          autoComplete="email"
          placeholder={t("form.emailPlaceholder")}
          onChange={(e) => setEmail(e.target.value)}
          disabled={isLoading}
        />
      </div>
      <Button type="submit" disabled={isLoading}>
        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {isLoading ? t("form.submitting") : t("form.submit")}
      </Button>
    </form>
  );
}
