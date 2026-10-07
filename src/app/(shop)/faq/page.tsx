import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { StaticPage } from "@/components/pages";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pages.faq.meta");
  return { title: t("title"), description: t("description") };
}

export default function FaqPage() {
  return <StaticPage namespace="pages.faq" />;
}
