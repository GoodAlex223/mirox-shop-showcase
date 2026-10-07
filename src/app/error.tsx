"use client";

import { useEffect } from "react";
import { XCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { StatusScreen } from "@/components/common/StatusScreen";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("system.error");

  useEffect(() => {
    console.error("[App Error]", error);
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
        {
          label: t("home"),
          onClick: () => (window.location.href = "/"),
          variant: "outline",
        },
      ]}
    />
  );
}
