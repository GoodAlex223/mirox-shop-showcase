import { site } from "./site";
import { MANAGER_TELEGRAM_HREF, WHATSAPP_HREF } from "./brand";

/**
 * Checkout config.
 * All display copy moved to messages/uk.json's `checkout` namespace (TASK-039
 * i18n G9 Task 5) — this module now holds only non-translatable config:
 * manager contact links and the client-supplied prepay card details.
 *
 * CLIENT-SUPPLIED, PENDING: `payment.prepay.cardNumber`
 * / `cardHolder` (manual full-prepayment card details). While null, the UI renders the
 * contact-the-manager fallback — filling the value lights the block up with no code change.
 */
export const checkout = {
  payment: {
    prepay: {
      /** CLIENT-SUPPLIED, PENDING — see module doc comment. */
      cardNumber: null as string | null,
      cardHolder: null as string | null,
    },
  },
  /**
   * Manager contact links. manager is single-sourced from brand.ts
   * (MANAGER_TELEGRAM_HREF, G23 §6) — distinct from telegram below, which is
   * the shop CHANNEL, not the manager who answers. whatsapp is single-sourced
   * from brand.ts (WHATSAPP_HREF, CLIENT-SUPPLIED, PENDING): null
   * hides the link — unlike site.ts's socials there is no real handle to fall
   * back on, and a zero-filled wa.me number would render as a clickable dead
   * link (PR #29 review). Fill with the real number to light it up.
   */
  contacts: {
    manager: MANAGER_TELEGRAM_HREF,
    instagram: site.socials.find((s) => s.platform === "instagram")?.href ?? null,
    telegram: site.socials.find((s) => s.platform === "telegram")?.href ?? null,
    whatsapp: WHATSAPP_HREF,
  },
};
