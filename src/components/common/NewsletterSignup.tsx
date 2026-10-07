"use client";

import { useState, FormEvent } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

export function NewsletterSignup() {
  const t = useTranslations("newsletter.signup");
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;

    setIsLoading(true);
    try {
      const response = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        // data.error is EN API/log text — map the machine code instead.
        // Guarded dynamic key (next-intl v4.13.6 t.has, verified available —
        // TASK-039 Task 5): unknown/absent codes fall back to fallback.
        const code = data.code as string | undefined;
        const key = code ? `byCode.${code}` : "";
        toast.error(key && t.has(key as never) ? t(key as never) : t("fallback"));
        return;
      }

      setIsSuccess(true);
      setEmail("");
      toast.success(t("successToast"));
    } catch {
      toast.error(t("fallback"));
    } finally {
      setIsLoading(false);
    }
  }

  if (isSuccess) {
    return (
      <div className="border-border bg-muted flex items-start gap-2 rounded-md border p-3">
        <CheckCircle2 className="text-foreground h-5 w-5 flex-shrink-0" />
        <p className="text-foreground text-sm">{t("successMessage")}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <Input
        type="email"
        placeholder={t("emailPlaceholder")}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        disabled={isLoading}
        required
        className="bg-card"
      />
      <Button type="submit" disabled={isLoading} className="w-full" size="sm">
        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {isLoading ? t("submitting") : t("submit")}
      </Button>
      <p className="text-muted-foreground text-xs">{t("privacyNote")}</p>
    </form>
  );
}
