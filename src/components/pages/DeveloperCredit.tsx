import { useTranslations } from "next-intl";
import { DEVELOPER_CREDIT_HREF } from "@/content/brand";

/**
 * Developer credit block for /about (G23 spec, Task 9 of TASK-055).
 *
 * Rendered as `children` of
 * <StaticPage/> rather than folded into `pages.about.sections`, because
 * StaticPage's shell only knows how to render section bodies as plain
 * strings — this block needs a real `<a>` link, which plain text can't carry.
 *
 * Sync (not async), so it uses useTranslations — same shape as
 * SellerRequisites.tsx: it renders inside an async Server Component page
 * (AboutPage) but is itself an ordinary Server Component, no "use client".
 */
export function DeveloperCredit() {
  const t = useTranslations("pages.about.credit");

  return (
    <section className="border-border mt-10 rounded-lg border p-6">
      <h2 className="text-lg font-bold">{t("heading")}</h2>
      <p className="text-muted-foreground mt-3 text-[15px] leading-relaxed">
        {t("body")}{" "}
        <a
          href={DEVELOPER_CREDIT_HREF}
          target="_blank"
          rel="noopener noreferrer"
          className="text-foreground font-semibold underline underline-offset-4"
        >
          {t("linkLabel")}
        </a>
      </p>
    </section>
  );
}
