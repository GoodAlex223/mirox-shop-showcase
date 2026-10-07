export const dynamic = "force-dynamic";
import { useTranslations } from "next-intl";
import { StatusScreen } from "@/components/common/StatusScreen";

export default function NotFound() {
  const t = useTranslations("system.notFound");
  return (
    <StatusScreen
      title={t("title")}
      description={t("description")}
      actions={[{ label: t("cta"), href: "/" }]}
    />
  );
}
