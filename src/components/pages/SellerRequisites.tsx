import Link from "next/link";
import { useTranslations } from "next-intl";
import { MANAGER_TELEGRAM_HREF } from "@/content/brand";
import { LEGAL_ENTITY } from "@/content/legal";

/**
 * Seller identity block for /terms, /privacy and /returns (G23 spec §3).
 *
 * Both branches are production states. The null branch renders the
 * brand + contact fallback until the seller's requisites are configured.
 * Copy in the surrounding pages is written so neither branch leaves a dangling sentence.
 *
 * Sync (not async), so it uses useTranslations — it renders inside an async
 * page but is itself an ordinary Server Component.
 */
export function SellerRequisites() {
  const t = useTranslations("pages.common.requisites");

  return (
    <section className="border-border mt-10 rounded-lg border p-6">
      <h2 className="text-lg font-bold">{t("heading")}</h2>

      {LEGAL_ENTITY ? (
        <dl className="mt-4 grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-[max-content_1fr]">
          <dt className="text-muted-foreground text-sm">{t("form")}</dt>
          <dd className="text-sm">{LEGAL_ENTITY.form}</dd>
          <dt className="text-muted-foreground text-sm">{t("name")}</dt>
          <dd className="text-sm">{LEGAL_ENTITY.name}</dd>
          <dt className="text-muted-foreground text-sm">{t("edrpou")}</dt>
          <dd className="text-sm">{LEGAL_ENTITY.edrpou}</dd>
          <dt className="text-muted-foreground text-sm">{t("address")}</dt>
          <dd className="text-sm">{LEGAL_ENTITY.address}</dd>
          {LEGAL_ENTITY.email ? (
            <>
              <dt className="text-muted-foreground text-sm">{t("email")}</dt>
              <dd className="text-sm">{LEGAL_ENTITY.email}</dd>
            </>
          ) : null}
        </dl>
      ) : (
        <div className="mt-4 space-y-3">
          <p className="text-muted-foreground text-sm">
            <span className="text-foreground font-semibold">{t("fallbackSeller")}: </span>
            {t("fallbackBody")}
          </p>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <Link href="/feedback" className="text-sm font-semibold underline underline-offset-4">
              {t("fallbackCta")}
            </Link>
            <a
              href={MANAGER_TELEGRAM_HREF}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-semibold underline underline-offset-4"
            >
              {t("fallbackTelegram")}
            </a>
          </div>
        </div>
      )}
    </section>
  );
}
