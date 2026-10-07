import { describe, it, expect } from "vitest";
import { MANAGER_TELEGRAM_HREF, REVIEWS_CHANNEL_HREF, WHATSAPP_HREF } from "@/content/brand";
import { checkout } from "@/content/checkout";
import { emails } from "@/content/emails";

describe("manager contact single-sourcing", () => {
  it("exposes the manager handle distinctly from the shop channel", () => {
    expect(MANAGER_TELEGRAM_HREF).toBe("https://t.me/mirox_manager");
    expect(REVIEWS_CHANNEL_HREF).toBe("https://t.me/mirox_vidgyk");
  });

  it("leaves the WhatsApp slot null rather than filling it with Telegram", () => {
    // G23 spec §6 — the deliberate deviation from BACKLOG [2026-09-16].
    expect(WHATSAPP_HREF).toBeNull();
  });

  it("reaches the checkout payment step", () => {
    expect(checkout.contacts.manager).toBe(MANAGER_TELEGRAM_HREF);
  });

  it("reaches the order e-mail contact block exactly once", () => {
    const hrefs = emails.order.contacts.map((c) => c.href);
    expect(hrefs).toContain(MANAGER_TELEGRAM_HREF);
    expect(hrefs.filter((h) => h === MANAGER_TELEGRAM_HREF)).toHaveLength(1);
  });
});
