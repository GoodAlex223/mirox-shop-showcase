"use client";

import { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { setLocale } from "@/i18n/actions";
import { LOCALES, LOCALE_LABELS, type Locale } from "@/i18n/config";
import { cn } from "@/lib/utils";

/** UA | RU header toggle (TASK-039 spec §1). Active locale is disabled. */
export function LocaleSwitcher({ className }: { className?: string }) {
  const locale = useLocale();
  const t = useTranslations("common");
  const [isPending, startTransition] = useTransition();

  return (
    <div
      role="group"
      aria-label={t("localeSwitcher")}
      data-testid="locale-switcher"
      className={cn("flex items-center", className)}
    >
      {LOCALES.map((l: Locale, i) => (
        <button
          key={l}
          type="button"
          disabled={isPending || l === locale}
          aria-current={l === locale ? "true" : undefined}
          data-testid={`locale-switcher-${l}`}
          onClick={() => startTransition(() => setLocale(l))}
          className={cn(
            "px-1.5 py-1 text-xs font-semibold tracking-wide uppercase transition-colors",
            i > 0 && "border-border border-l",
            l === locale
              ? "text-foreground"
              : "text-muted-foreground hover:text-foreground cursor-pointer"
          )}
        >
          {LOCALE_LABELS[l]}
        </button>
      ))}
    </div>
  );
}
