import { escapeHtml } from "@/lib/newsletter";
import { formatPrice } from "@/lib/format";
import { getShippingMethodLabel } from "@/lib/shipping";
import { emails } from "@/content/emails";
import { EMAIL_COLORS, renderButton, renderEmailShell, renderPanel } from "./layout";

export interface OrderEmailData {
  orderNumber: string;
  email: string;
  items: Array<{
    productName: string;
    variantInfo?: string | null;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }>;
  subtotal: number;
  shippingCost: number;
  tax: number;
  total: number;
  shippingAddress: {
    name: string;
    company?: string;
    line1: string;
    line2?: string;
    city: string;
    state?: string;
    postalCode?: string;
    /**
     * Kept required — mirrors the stored order address (checkout always
     * submits "UA") — but deliberately NOT rendered: the confirmation page
     * shows no country line either (visual-gate ruling 2026-08-10).
     */
    country: string;
  };
  shippingMethod: string;
  /**
   * Selects which CTA the contact panel renders: signed-in customers get
   * «ІСТОРІЯ ЗАМОВЛЕНЬ» -> /account/orders. Guest COD orders (userId null)
   * have no account page — the G2 ruling hid the account CTA for them, and
   * G18 replaced that gap with a «СТАТУС ЗАМОВЛЕННЯ» -> /track?order=<N> CTA
   * instead. One CTA always renders; which one depends on this flag.
   */
  hasAccount: boolean;
}

const t = emails.order;

function renderItemsRows(items: OrderEmailData["items"]): string {
  return items
    .map(
      (item) => `
      <tr>
        <td style="padding: 12px 0; border-bottom: 1px solid ${EMAIL_COLORS.border};">
          <div style="font-weight: 600;">${escapeHtml(item.productName)}</div>
          ${item.variantInfo ? `<div style="color: ${EMAIL_COLORS.muted}; font-size: 14px;">${escapeHtml(item.variantInfo)}</div>` : ""}
          <div style="color: ${EMAIL_COLORS.muted}; font-size: 14px;">${t.qty(item.quantity)}</div>
        </td>
        <td align="right" style="padding: 12px 0; border-bottom: 1px solid ${EMAIL_COLORS.border}; text-align: right; font-weight: 600; white-space: nowrap;">
          ${formatPrice(item.totalPrice)}
        </td>
      </tr>`
    )
    .join("");
}

function renderTotals(data: OrderEmailData): string {
  const row = (label: string, value: number) =>
    `<tr><td style="color: ${EMAIL_COLORS.muted}; padding: 4px 0;">${label}</td><td align="right" style="text-align: right; padding: 4px 0;">${formatPrice(value)}</td></tr>`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
    ${row(t.subtotalLabel, data.subtotal)}
    ${row(t.shippingLabel, data.shippingCost)}
    ${data.tax > 0 ? row(t.taxLabel, data.tax) : ""}
    <tr>
      <td style="border-top: 1px solid ${EMAIL_COLORS.border}; padding-top: 12px; font-weight: 700;">${t.totalLabel}</td>
      <td align="right" style="border-top: 1px solid ${EMAIL_COLORS.border}; padding-top: 12px; text-align: right; font-weight: 700;">${formatPrice(data.total)}</td>
    </tr>
  </table>`;
}

function renderAddress(a: OrderEmailData["shippingAddress"]): string {
  return [
    escapeHtml(a.name),
    a.company ? escapeHtml(a.company) : null,
    escapeHtml(a.line1),
    a.line2 ? escapeHtml(a.line2) : null,
    `${escapeHtml(a.city)}${a.state ? `, ${escapeHtml(a.state)}` : ""}${a.postalCode ? ` ${escapeHtml(a.postalCode)}` : ""}`,
  ]
    .filter(Boolean)
    .join("<br>");
}

export function generateOrderConfirmationHtml(data: OrderEmailData): string {
  const successPanel = renderPanel(
    `<table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 auto 16px;">
      <tr>
        <td bgcolor="${EMAIL_COLORS.success}" width="48" height="48" align="center" style="background-color: ${EMAIL_COLORS.success}; border-radius: 50%; color: #000000; font-size: 24px; font-weight: 700;">&#10003;</td>
      </tr>
    </table>
    <h2 style="margin: 0 0 8px 0; font-size: 20px;">${t.heading}</h2>
    <p style="margin: 0; color: ${EMAIL_COLORS.muted};">${t.thanks}</p>`,
    { center: true }
  );

  const orderNumberPanel = renderPanel(
    `<p style="margin: 0; color: ${EMAIL_COLORS.muted}; font-size: 14px;">${t.orderNumberLabel}</p>
    <p style="margin: 4px 0 0 0; font-size: 20px; font-weight: 700;">${data.orderNumber}</p>`,
    { center: true }
  );

  const detailsPanel = renderPanel(
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; margin-bottom: 24px;">${renderItemsRows(data.items)}</table>
    ${renderTotals(data)}
    <p style="margin: 0 0 4px 0; color: ${EMAIL_COLORS.muted}; font-size: 14px;">${t.addressHeading}</p>
    <p style="margin: 0 0 16px 0; font-size: 14px;">${renderAddress(data.shippingAddress)}</p>
    <p style="margin: 0 0 4px 0; color: ${EMAIL_COLORS.muted}; font-size: 14px;">${t.methodHeading}</p>
    <p style="margin: 0; font-size: 14px;">${escapeHtml(getShippingMethodLabel(data.shippingMethod))}</p>`
  );

  const contactLinks = t.contacts
    .map(
      (s) =>
        `<a href="${s.href}" style="color: ${EMAIL_COLORS.text}; text-decoration: underline;">${s.label}</a>`
    )
    .join(" &middot; ");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  // Signed-in customers get the account page; guests get the grant-gated
  // status page with the number prefilled (G18) — one button, never both.
  const ctaButton = data.hasAccount
    ? renderButton(`${appUrl}/account/orders`, t.cta)
    : renderButton(`${appUrl}/track?order=${encodeURIComponent(data.orderNumber)}`, t.guestCta);

  const contactPanel = renderPanel(
    `<p style="margin: 0 0 8px 0; color: ${EMAIL_COLORS.muted};">${t.contactHeading}</p>
    <p style="margin: 0 0 20px 0;">${contactLinks}</p>
    ${ctaButton}`,
    { center: true }
  );

  return renderEmailShell({
    title: t.title,
    bodyHtml: `${successPanel}${orderNumberPanel}${detailsPanel}${contactPanel}`,
  });
}
