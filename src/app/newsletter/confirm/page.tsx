"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { StatusScreen } from "@/components/common/StatusScreen";

type ConfirmState =
  | { status: "loading" }
  | { status: "success"; code: string }
  | { status: "error"; code: string };

function ConfirmContent() {
  const t = useTranslations("newsletter.confirm");
  const tActions = useTranslations("newsletter.actions");
  const searchParams = useSearchParams();
  const token = searchParams?.get("token") ?? null;

  const [state, setState] = useState<ConfirmState>(
    token ? { status: "loading" } : { status: "error", code: "TOKEN_REQUIRED" }
  );

  useEffect(() => {
    if (!token) return;

    async function confirmSubscription() {
      try {
        const response = await fetch(`/api/newsletter/confirm?token=${token}`);
        const data = await response.json().catch(() => ({}));
        // API prose is EN log text; `code` drives the Ukrainian copy.
        const code = (data.code as string | undefined) || (response.ok ? "CONFIRMED" : "");
        setState({ status: response.ok ? "success" : "error", code });
      } catch {
        setState({ status: "error", code: "" });
      }
    }

    confirmSubscription();
  }, [token]);

  if (state.status === "loading") {
    return (
      <StatusScreen
        icon={Loader2}
        iconClassName="animate-spin"
        title={t("loading.title")}
        description={t("loading.description")}
      />
    );
  }

  // Guarded dynamic key (next-intl v4.13.6 t.has, verified available —
  // TASK-039 Task 5): each byCode entry is an object ({title, description}),
  // so the guard checks the STRING LEAF (.title), never the parent object
  // path — t.has() returns true for object paths too, which would be a false
  // pass. `as never` is the deliberate escape hatch for next-intl's
  // generically-typed key union (rejects a widened runtime string).
  const leaf = state.code ? `byCode.${state.code}.title` : "";
  const base = leaf && t.has(leaf as never) ? `byCode.${state.code}` : "fallback";

  if (state.status === "success") {
    return (
      <StatusScreen
        icon={CheckCircle2}
        tone="success"
        title={t(`${base}.title` as never)}
        description={t(`${base}.description` as never)}
        actions={[{ label: tActions("continueShopping"), href: "/" }]}
      />
    );
  }

  return (
    <StatusScreen
      icon={XCircle}
      tone="error"
      title={t(`${base}.title` as never)}
      description={t(`${base}.description` as never)}
      actions={[{ label: tActions("goHome"), href: "/", variant: "outline" }]}
    />
  );
}

export default function NewsletterConfirmPage() {
  const t = useTranslations("newsletter.confirm");
  return (
    <Suspense
      fallback={
        <StatusScreen icon={Loader2} iconClassName="animate-spin" title={t("loading.title")} />
      }
    >
      <ConfirmContent />
    </Suspense>
  );
}
