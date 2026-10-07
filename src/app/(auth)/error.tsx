"use client";

import { useEffect } from "react";
import { XCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { StatusScreen } from "@/components/common/StatusScreen";

export default function AuthError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("auth.error");

  useEffect(() => {
    console.error("[Auth Error]", error);
  }, [error]);

  return (
    <StatusScreen
      icon={XCircle}
      tone="error"
      title={t("title")}
      description={t("description")}
      meta={error.digest ? t("errorId", { digest: error.digest }) : undefined}
      actions={[
        { label: t("retry"), onClick: () => reset() },
        { label: t("backToLogin"), href: "/login", variant: "outline" },
      ]}
    />
  );
}
