import { Instagram, MessageCircle, Send } from "lucide-react";
import { useTranslations } from "next-intl";
import type { checkout } from "@/content/checkout";

interface CheckoutContactLinksProps {
  contacts: (typeof checkout)["contacts"];
}

const linkClass =
  "text-foreground hover:text-muted-foreground flex items-center gap-1.5 text-[13px] font-bold transition-colors";

/**
 * Payment-step manager/contact block (G23 §6 fix round 1). Extracted out of
 * CheckoutPage so it's independently renderable in tests — a full RTL render
 * of the checkout page (cart store, session, multi-step form) is
 * impractical, and that impracticality is exactly what let `contacts.manager`
 * go unrendered in the first place (a component that silently ignores one of
 * its four input fields).
 *
 * No cart-store/session/router dependency: takes `contacts` as its only
 * prop, so it stays a pure presentational component.
 *
 * Order: manager first (the adjacent prose «Напишіть менеджеру» names the
 * manager specifically, and the order e-mail already puts the manager at
 * contacts[0] — see src/content/emails.ts), then instagram, whatsapp,
 * telegram (the shop CHANNEL, distinct from manager — see checkout.ts's
 * module doc comment). `manager` is always a live string (unlike the other
 * three, which are `string | null`), so it renders unconditionally; the
 * others stay null-gated — a zero-filled/empty href would render a
 * clickable dead link (PR #29 review ruling).
 */
export function CheckoutContactLinks({ contacts }: CheckoutContactLinksProps) {
  const t = useTranslations("checkout");

  return (
    <div className="mt-3 flex items-center gap-4">
      <a href={contacts.manager} target="_blank" rel="noopener noreferrer" className={linkClass}>
        <Send className="h-4 w-4" /> {t("payment.contacts.manager")}
      </a>
      {contacts.instagram && (
        <a
          href={contacts.instagram}
          target="_blank"
          rel="noopener noreferrer"
          className={linkClass}
        >
          <Instagram className="h-4 w-4" /> Instagram
        </a>
      )}
      {contacts.whatsapp && (
        <a href={contacts.whatsapp} target="_blank" rel="noopener noreferrer" className={linkClass}>
          <MessageCircle className="h-4 w-4" /> WhatsApp
        </a>
      )}
      {contacts.telegram && (
        <a href={contacts.telegram} target="_blank" rel="noopener noreferrer" className={linkClass}>
          <Send className="h-4 w-4" /> Telegram
        </a>
      )}
    </div>
  );
}
