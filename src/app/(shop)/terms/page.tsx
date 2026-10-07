import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { SellerRequisites, StaticPage } from "@/components/pages";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pages.terms.meta");
  return { title: t("title"), description: t("description") };
}

export default function TermsPage() {
  return (
    <StaticPage namespace="pages.terms">
      <SellerRequisites />
    </StaticPage>
  );
}
