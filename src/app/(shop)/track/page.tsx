import type { Metadata } from "next";
import { Suspense } from "react";
import { useTranslations } from "next-intl";
import { TrackForm } from "./track-form";

// Metadata stays EN like the rest of the SEO layer (BACKLOG'd UA-metadata
// sweep) — the page body is UA/RU via the catalog.
export const metadata: Metadata = {
  title: "Order status",
  description: "Check the status of your Mirox Shop order by order number and e-mail.",
};

export default function TrackPage() {
  const t = useTranslations("track.page");
  return (
    <div className="container max-w-2xl py-12">
      <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
      <p className="text-muted-foreground mt-3">{t("description")}</p>
      <div className="mt-8">
        {/* useSearchParams needs a Suspense boundary on Next 14 or the build fails. */}
        <Suspense fallback={null}>
          <TrackForm />
        </Suspense>
      </div>
    </div>
  );
}
