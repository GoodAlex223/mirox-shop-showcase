import type { ReactNode } from "react";
import type { Messages, NamespaceKeys, NestedKeyOf } from "next-intl";
import { getTranslations } from "next-intl/server";

/** One section of an info page. `list` is optional; most sections are prose only. */
export type PageSection = {
  heading: string;
  body: string[];
  list?: string[];
};

// next-intl 4.13.6's `getTranslations` overloads require a namespace typed
// against the catalog (`global.d.ts`'s `AppConfig.Messages` augmentation), not
// a plain `string` — a bare `string` widens past every overload and fails
// `tsc --noEmit`. This is the catalog-wide namespace-key type; StaticPage is
// only ever called with a `pages.*` path, but there's no narrower exported
// type for "just the pages subtree" short of hand-rolling one.
type CatalogNamespace = NamespaceKeys<Messages, NestedKeyOf<Messages>>;

interface StaticPageProps {
  /** Full catalog path, e.g. "pages.terms". */
  namespace: CatalogNamespace;
  /** Rendered after the sections — used to mount <SellerRequisites/>. */
  children?: ReactNode;
}

/**
 * Shared shell for the six non-/contact info pages (G23 spec §5).
 *
 * Reads its whole body from the `pages` catalog namespace, which is withheld
 * from the client payload (spec §4) — so this must stay a Server Component and
 * must never be imported by a "use client" module.
 *
 * `t.raw` is used for `sections` because it takes a TYPED key and returns the
 * raw array, letting us map over it. The alternative — a literal t() call per
 * section — is what Footer.tsx was forced into for its four benefits, and does
 * not scale to a twelve-section public offer.
 */
export async function StaticPage({ namespace, children }: StaticPageProps) {
  const t = await getTranslations(namespace);
  const sections = (t.raw("sections") ?? []) as PageSection[];
  const intro = t.raw("intro") as string | undefined;

  return (
    <div className="container max-w-3xl py-12">
      <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
      {intro ? <p className="text-muted-foreground mt-3 text-base">{intro}</p> : null}

      <div className="mt-10 space-y-10">
        {sections.map((section) => (
          <section key={section.heading}>
            <h2 className="text-xl font-bold tracking-tight">{section.heading}</h2>
            <div className="mt-3 space-y-3">
              {section.body.map((paragraph) => (
                <p key={paragraph} className="text-muted-foreground text-[15px] leading-relaxed">
                  {paragraph}
                </p>
              ))}
            </div>
            {section.list ? (
              <ul className="text-muted-foreground mt-3 list-disc space-y-2 pl-5 text-[15px] leading-relaxed">
                {section.list.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : null}
          </section>
        ))}
      </div>

      {children}
    </div>
  );
}
