"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, XCircle, Loader2, Mail } from "lucide-react";
import { useTranslations } from "next-intl";
import { StatusScreen } from "@/components/common/StatusScreen";

type UnsubscribeState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; code: string }
  | { status: "error"; code: string };

function UnsubscribeContent() {
  const t = useTranslations("newsletter.unsubscribe");
  const tActions = useTranslations("newsletter.actions");
  const searchParams = useSearchParams();
  const email = searchParams?.get("email") ?? null;
  const token = searchParams?.get("token") ?? null;

  const [state, setState] = useState<UnsubscribeState>({ status: "idle" });

  async function handleUnsubscribe() {
    if (!email || !token) {
      setState({ status: "error", code: "" });
      return;
    }

    setState({ status: "loading" });
    try {
      const response = await fetch("/api/newsletter/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, token }),
      });

      const data = await response.json().catch(() => ({}));
      // API prose is EN log text; `code` drives the Ukrainian copy.
      const code = (data.code as string | undefined) || (response.ok ? "UNSUBSCRIBED" : "");
      setState({ status: response.ok ? "success" : "error", code });
    } catch {
      setState({ status: "error", code: "" });
    }
  }

  if (!email || !token) {
    return (
      <StatusScreen
        icon={XCircle}
        tone="error"
        title={t("invalidLink.title")}
        description={t("invalidLink.description")}
        actions={[{ label: tActions("goHome"), href: "/", variant: "outline" }]}
      />
    );
  }

  if (state.status === "idle") {
    return (
      <StatusScreen
        icon={Mail}
        title={t("idle.title")}
        description={t("idle.prompt", { email })}
        actions={[
          {
            label: t("idle.confirm"),
            onClick: handleUnsubscribe,
            variant: "destructive",
          },
        ]}
      />
    );
  }

  if (state.status === "loading") {
    return (
      <StatusScreen
        icon={Loader2}
        iconClassName="animate-spin"
        title={t("processing.title")}
        description={t("processing.description")}
      />
    );
  }

  // Guarded dynamic key (next-intl v4.13.6 t.has, verified available —
  // TASK-039 Task 5): mirrors newsletter/confirm/page.tsx — each byCode entry
  // is an object ({title, description}), so the guard checks the STRING LEAF
  // (.title), never the parent object path (t.has() returns true for object
  // paths too, which would be a false pass). `as never` is the deliberate
  // escape hatch for next-intl's generically-typed key union.
  const leaf = state.code ? `byCode.${state.code}.title` : "";
  const base = leaf && t.has(leaf as never) ? `byCode.${state.code}` : "fallback";
  const icon = state.status === "success" ? CheckCircle2 : XCircle;
  return (
    <StatusScreen
      icon={icon}
      tone={state.status}
      title={t(`${base}.title` as never)}
      description={t(`${base}.description` as never)}
      actions={[{ label: tActions("goHome"), href: "/", variant: "outline" }]}
    />
  );
}

export default function NewsletterUnsubscribePage() {
  const t = useTranslations("newsletter.unsubscribe");
  return (
    <Suspense
      fallback={
        <StatusScreen icon={Loader2} iconClassName="animate-spin" title={t("processing.title")} />
      }
    >
      <UnsubscribeContent />
    </Suspense>
  );
}
