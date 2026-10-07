import { escapeHtml } from "@/lib/newsletter";
import { emails, getStoreName } from "@/content/emails";
import { EMAIL_COLORS, renderButton, renderEmailShell, renderPanel } from "./layout";

export function generateNewsletterConfirmationHtml(data: {
  email: string;
  confirmationUrl: string;
  unsubscribeUrl?: string;
}): string {
  const t = emails.newsletter;

  const introPanel = renderPanel(
    `<h2 style="margin: 0 0 16px 0; font-size: 20px;">${t.heading}</h2>
    <p style="margin: 0; color: ${EMAIL_COLORS.muted};">${t.introPrefix} ${getStoreName()}: <strong style="color: ${EMAIL_COLORS.text};">${escapeHtml(data.email)}</strong></p>`
  );

  const ctaBlock = `<p style="margin: 0 0 16px 0;">${t.body}</p>
  <div style="margin-bottom: 32px;">${renderButton(data.confirmationUrl, t.cta)}</div>`;

  const safetyPanel = renderPanel(
    `<p style="margin: 0; font-size: 14px; color: ${EMAIL_COLORS.muted};"><strong style="color: ${EMAIL_COLORS.text};">${t.safetyTitle}</strong> ${t.safetyText}</p>`
  );

  const footerExtraHtml = data.unsubscribeUrl
    ? `<p style="margin: 8px 0 0 0;"><a href="${data.unsubscribeUrl}" style="color: ${EMAIL_COLORS.faint}; text-decoration: underline;">${t.unsubscribe}</a></p>`
    : undefined;

  return renderEmailShell({
    title: t.title,
    bodyHtml: `${introPanel}${ctaBlock}${safetyPanel}`,
    footerExtraHtml,
  });
}
