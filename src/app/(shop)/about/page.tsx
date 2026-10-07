import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { StaticPage, DeveloperCredit } from "@/components/pages";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pages.about.meta");
  return { title: t("title"), description: t("description") };
}

export default function AboutPage() {
  return (
    <StaticPage namespace="pages.about">
      <DeveloperCredit />
    </StaticPage>
  );
}
