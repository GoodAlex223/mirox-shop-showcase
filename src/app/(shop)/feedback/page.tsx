import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { FeedbackForm } from "./feedback-form";

// Metadata stays EN like the rest of the SEO layer (BACKLOG'd for the
// UA-metadata sweep; G9 rules on it) — the page body is UA via content.
export const metadata: Metadata = {
  title: "Feedback",
  description: "Tell us about problems or ideas — the Mirox Shop feedback form.",
};

export default function FeedbackPage() {
  const t = useTranslations("feedback.page");
  return (
    <div className="container max-w-2xl py-12">
      <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
      <p className="text-muted-foreground mt-3">{t("description")}</p>
      <div className="mt-8">
        <FeedbackForm />
      </div>
    </div>
  );
}
