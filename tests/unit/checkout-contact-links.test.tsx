import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithIntl } from "../helpers/render-with-intl";
import { CheckoutContactLinks } from "@/components/checkout";
import { checkout } from "@/content/checkout";
import { MANAGER_TELEGRAM_HREF } from "@/content/brand";

/**
 * G23 §6 fix round 1: checkout.contacts.manager existed and was asserted at
 * the data layer (tests/unit/manager-contact.test.ts) but was never rendered
 * anywhere — the payment step showed Instagram/WhatsApp/Telegram(channel)
 * only. CheckoutContactLinks was extracted specifically so this is
 * renderable without the full checkout page's cart-store/session/form deps.
 */
describe("<CheckoutContactLinks/>", () => {
  it("renders the manager link from checkout.contacts.manager, first among the four", () => {
    renderWithIntl(<CheckoutContactLinks contacts={checkout.contacts} />);

    const links = screen.getAllByRole("link");
    expect(links[0]).toHaveAttribute("href", MANAGER_TELEGRAM_HREF);
    expect(screen.getByRole("link", { name: /Менеджер/i })).toHaveAttribute(
      "href",
      MANAGER_TELEGRAM_HREF
    );
  });

  it("still renders instagram and the shop-channel telegram", () => {
    renderWithIntl(<CheckoutContactLinks contacts={checkout.contacts} />);

    expect(screen.getByRole("link", { name: /Instagram/i })).toHaveAttribute(
      "href",
      checkout.contacts.instagram
    );
    expect(screen.getByRole("link", { name: /Telegram/i })).toHaveAttribute(
      "href",
      checkout.contacts.telegram
    );
  });

  it("renders no anchor for whatsapp while WHATSAPP_HREF is null (no empty link)", () => {
    // Guard against the null-gate regressing silently: whatsapp really is
    // null in production content today, not just in a hand-built fixture.
    expect(checkout.contacts.whatsapp).toBeNull();

    renderWithIntl(<CheckoutContactLinks contacts={checkout.contacts} />);
    expect(screen.queryByRole("link", { name: /WhatsApp/i })).not.toBeInTheDocument();
    expect(screen.getAllByRole("link")).toHaveLength(3);
  });

  it("renders whatsapp once a number is supplied", () => {
    renderWithIntl(
      <CheckoutContactLinks
        contacts={{ ...checkout.contacts, whatsapp: "https://wa.me/380501234567" }}
      />
    );

    expect(screen.getByRole("link", { name: /WhatsApp/i })).toHaveAttribute(
      "href",
      "https://wa.me/380501234567"
    );
    expect(screen.getAllByRole("link")).toHaveLength(4);
  });
});
