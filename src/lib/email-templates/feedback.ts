import { escapeHtml } from "@/lib/newsletter";
import { emails } from "@/content/emails";
import { EMAIL_COLORS, renderEmailShell, renderPanel } from "./layout";

export interface FeedbackEmailData {
  name?: string;
  email?: string;
  message: string;
}

export function generateFeedbackEmailHtml(data: FeedbackEmailData): string {
  const t = emails.feedback;

  const contactRows = [
    data.name
      ? `<p style="margin: 0 0 4px 0; color: ${EMAIL_COLORS.muted};">${t.nameLabel}: <strong style="color: ${EMAIL_COLORS.text};">${escapeHtml(data.name)}</strong></p>`
      : "",
    data.email
      ? `<p style="margin: 0; color: ${EMAIL_COLORS.muted};">${t.emailLabel}: <strong style="color: ${EMAIL_COLORS.text};">${escapeHtml(data.email)}</strong></p>`
      : "",
  ].join("");

  const introPanel = renderPanel(
    `<h2 style="margin: 0 0 16px 0; font-size: 20px;">${t.heading}</h2>
    ${contactRows || `<p style="margin: 0; color: ${EMAIL_COLORS.muted};">${t.anonymous}</p>`}`
  );

  // Escape FIRST, then substitute newlines — the substitution must never run
  // on raw user input.
  const messageHtml = escapeHtml(data.message).replace(/\r?\n/g, "<br>");
  const messagePanel = renderPanel(`<p style="margin: 0;">${messageHtml}</p>`);

  return renderEmailShell({ title: t.title, bodyHtml: `${introPanel}${messagePanel}` });
}
