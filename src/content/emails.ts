import { BRAND_NAME, MANAGER_TELEGRAM_HREF, SOCIALS, WHATSAPP_HREF } from "./brand";

/**
 * Transactional email copy (spec 2026-08-10-g5-transactional-emails-design.md
 * §5/§6). Single extraction point for TASK-039 i18n — plain typed strings.
 *
 * MUST stay lucide-free: this module is bundled into API routes via
 * src/lib/email.ts, and importing ./site would drag lucide-react along.
 * Only ./brand is allowed here.
 */

/**
 * Render-time brand resolution (spec §7): a module-scope const would freeze
 * the env value at import and break env-dependent tests.
 */
export function getStoreName(): string {
  return process.env.NEXT_PUBLIC_STORE_NAME || BRAND_NAME;
}

export const emails = {
  order: {
    subject: (orderNumber: string) => `Замовлення ${orderNumber} прийнято — ${getStoreName()}`,
    /** <title> tag — plain form, no exclamation. */
    title: "Замовлення прийнято",
    heading: "Замовлення прийнято!",
    thanks: "Дякуємо за замовлення!",
    orderNumberLabel: "Замовлення №",
    /** «× 2» — quantity line under each item. */
    qty: (n: number) => `× ${n}`,
    subtotalLabel: "Товари",
    shippingLabel: "Доставка",
    /** Rendered only when tax > 0 (COD is always 0; spec §5). */
    taxLabel: "Податок",
    totalLabel: "До сплати",
    addressHeading: "Адреса доставки",
    methodHeading: "Спосіб доставки",
    contactHeading: "Питання щодо замовлення? Напишіть нам:",
    /** Pre-uppercased like checkout.payment.submit. */
    cta: "ІСТОРІЯ ЗАМОВЛЕНЬ",
    /** Guest orders have no account page — this CTA opens /track prefilled (G18). */
    guestCta: "СТАТУС ЗАМОВЛЕННЯ",
    /**
     * Manager channels for the contact block — mirrors checkout.contacts.
     * The manager (MANAGER_TELEGRAM_HREF, G23 §6) leads the list, distinct
     * from SOCIALS' telegram entry below, which is the shop CHANNEL, not the
     * manager who answers; WhatsApp is appended once the client supplies the
     * number (user gate ruling 2026-08-10).
     */
    contacts: [
      { platform: "telegram" as const, label: "Менеджер", href: MANAGER_TELEGRAM_HREF },
      ...SOCIALS.filter((s) => s.platform === "instagram" || s.platform === "telegram"),
      ...(WHATSAPP_HREF
        ? [{ platform: "whatsapp" as const, label: "WhatsApp", href: WHATSAPP_HREF }]
        : []),
    ],
  },
  newsletter: {
    subject: () => `Підтвердіть підписку на розсилку ${getStoreName()}`,
    title: "Підтвердіть підписку",
    heading: "Підтвердіть підписку",
    /** Rendered as `${introPrefix} ${brand}: <strong>{escaped email}</strong>` */
    introPrefix: "Ви залишили цю адресу для підписки на розсилку",
    body: "Підтвердіть підписку — і ми надсилатимемо новинки та ексклюзивні пропозиції.",
    cta: "ПІДТВЕРДИТИ ПІДПИСКУ",
    safetyTitle: "Не запитували підписку?",
    safetyText: "Просто проігноруйте цей лист. Посилання дійсне 24 години.",
    unsubscribe: "Відписатися",
  },
  feedback: {
    subject: () => `Новий відгук із сайту — ${getStoreName()}`,
    title: "Новий відгук",
    heading: "Новий відгук із сайту",
    nameLabel: "Ім'я",
    emailLabel: "Email",
    /** Rendered when the visitor left neither name nor email. */
    anonymous: "Відправник не залишив контактів.",
  },
  footer: {
    rights: "Всі права захищені.",
  },
};
