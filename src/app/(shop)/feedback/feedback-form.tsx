"use client";

import { useState, FormEvent } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

export function FeedbackForm() {
  const t = useTranslations("feedback");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    // minLength counts raw characters, so a whitespace-only message passes
    // browser validation and lands here — never fail silently (PR #35 review).
    if (!message.trim()) {
      toast.error(t("byCode.VALIDATION_ERROR"));
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, message, website }),
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
    } catch {
      toast.error(t("fallback"));
    } finally {
      setIsLoading(false);
    }
  }

  if (isSuccess) {
    return (
      <div
        role="status"
        className="border-border bg-muted flex items-start gap-3 rounded-md border p-4"
      >
        <CheckCircle2 className="text-foreground h-5 w-5 flex-shrink-0" />
        <div>
          <p className="text-foreground font-semibold">{t("success.title")}</p>
          <p className="text-muted-foreground mt-1 text-sm">{t("success.description")}</p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="feedback-name" className="text-sm font-medium">
            {t("form.nameLabel")}
          </label>
          <Input
            id="feedback-name"
            value={name}
            maxLength={100}
            placeholder={t("form.namePlaceholder")}
            onChange={(e) => setName(e.target.value)}
            disabled={isLoading}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="feedback-email" className="text-sm font-medium">
            {t("form.emailLabel")}
          </label>
          <Input
            id="feedback-email"
            type="email"
            value={email}
            maxLength={254}
            placeholder={t("form.emailPlaceholder")}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isLoading}
          />
          <p className="text-muted-foreground text-xs">{t("form.emailHint")}</p>
        </div>
      </div>
      <div className="space-y-1.5">
        <label htmlFor="feedback-message" className="text-sm font-medium">
          {t("form.messageLabel")}
        </label>
        <Textarea
          id="feedback-message"
          value={message}
          required
          minLength={5}
          maxLength={2000}
          rows={6}
          placeholder={t("form.messagePlaceholder")}
          onChange={(e) => setMessage(e.target.value)}
          disabled={isLoading}
        />
      </div>
      {/* Honeypot: hidden from real users (display: none, no tab stop); bots
          that fill every field reveal themselves. The label text is
          deliberately EN bait, not UA copy — it must look like a real field
          to a bot and is never shown to people. */}
      <div className="hidden" aria-hidden="true">
        <label htmlFor="feedback-website">Website</label>
        <input
          id="feedback-website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
        />
      </div>
      <Button type="submit" disabled={isLoading}>
        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {isLoading ? t("form.submitting") : t("form.submit")}
      </Button>
    </form>
  );
}
