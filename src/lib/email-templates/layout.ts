import { emails, getStoreName } from "@/content/emails";

/**
 * Shared dark Mirox email shell (spec 2026-08-10-g5-transactional-emails-design.md §4).
 * Email-safe rules: tables + stacked blocks only, inline styles everywhere,
 * bgcolor attributes alongside CSS for Outlook, no <svg>, no grid/flex.
 */

export const EMAIL_COLORS = {
  bg: "#000000",
  panel: "#0d0d0d",
  border: "#1a1a1a",
  text: "#ffffff",
  muted: "#a3a3a3",
  faint: "#737373",
  success: "#4ade80",
} as const;

export const EMAIL_FONT_STACK = "'Manrope', -apple-system, 'Segoe UI', Roboto, Arial, sans-serif";

export function renderPanel(innerHtml: string, opts?: { center?: boolean }): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 16px;"><tr><td bgcolor="${EMAIL_COLORS.panel}" style="background-color: ${EMAIL_COLORS.panel}; border: 1px solid ${EMAIL_COLORS.border}; border-radius: 14px; padding: 24px;${opts?.center ? " text-align: center;" : ""}">${innerHtml}</td></tr></table>`;
}

export function renderButton(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 auto;"><tr><td bgcolor="#ffffff" style="background-color: #ffffff; border-radius: 8px;"><a href="${href}" style="display: inline-block; padding: 14px 32px; font-weight: 700; letter-spacing: 0.08em; font-size: 13px; color: #000000; text-decoration: none;">${label}</a></td></tr></table>`;
}

export function renderEmailShell(opts: {
  title: string;
  bodyHtml: string;
  footerExtraHtml?: string;
}): string {
  const storeName = getStoreName();
  const year = new Date().getFullYear();
  return `<!DOCTYPE html>
<html lang="uk">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700;800&display=swap" rel="stylesheet">
  <title>${opts.title}</title>
</head>
<body bgcolor="${EMAIL_COLORS.bg}" style="margin: 0; padding: 0; background-color: ${EMAIL_COLORS.bg};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${EMAIL_COLORS.bg}" style="background-color: ${EMAIL_COLORS.bg};">
    <tr>
      <td align="center" style="padding: 24px 12px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%; font-family: ${EMAIL_FONT_STACK}; line-height: 1.6; color: ${EMAIL_COLORS.text};">
          <tr>
            <td align="center" style="padding-bottom: 32px;">
              <span style="font-size: 22px; font-weight: 800; letter-spacing: -0.02em; color: ${EMAIL_COLORS.text};">${storeName}</span>
            </td>
          </tr>
          <tr>
            <td>${opts.bodyHtml}</td>
          </tr>
          <tr>
            <td align="center" style="padding-top: 24px; border-top: 1px solid ${EMAIL_COLORS.border}; color: ${EMAIL_COLORS.faint}; font-size: 13px;">
              <p style="margin: 0;">&copy; ${year} ${storeName}. ${emails.footer.rights}</p>${opts.footerExtraHtml ?? ""}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
