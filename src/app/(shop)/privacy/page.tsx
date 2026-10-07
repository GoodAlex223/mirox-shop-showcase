import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { SellerRequisites, StaticPage } from "@/components/pages";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pages.privacy.meta");
  return { title: t("title"), description: t("description") };
}

export default function PrivacyPage() {
  return (
    <StaticPage namespace="pages.privacy">
      <SellerRequisites />
    </StaticPage>
  );
}
