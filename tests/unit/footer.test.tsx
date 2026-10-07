import { screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { renderWithIntl } from "../helpers/render-with-intl";

vi.mock("@/components/common/NewsletterSignup", () => ({
  NewsletterSignup: () => <div data-testid="newsletter" />,
}));

import { Footer } from "@/components/common/Footer";

describe("Footer", () => {
  it("uses the Mirox tagline, not the generic template copy", () => {
    renderWithIntl(<Footer />);
    expect(screen.queryByText(/one-stop shop for quality products/i)).not.toBeInTheDocument();
    expect(screen.getByText(/цінує якість і мінімалізм/)).toBeInTheDocument();
  });

  it("links to the social profiles", () => {
    renderWithIntl(<Footer />);
    expect(screen.getByRole("link", { name: /Instagram/ })).toBeInTheDocument();
  });

  it("links to every route in both footer groups, now that the info pages exist (G23/TASK-055 Task 8)", () => {
    renderWithIntl(<Footer />);
    // Previously these seven were asserted absent (TASK-055's info pages
    // didn't exist yet, same rule as TASK-035). Task 8 is exactly the task
    // that wires them in via the new "Магазин"/"Інформація" band, so the
    // assertion flips from exclusion to inclusion. The exhaustive,
    // independently-counted version of this check lives in
    // tests/unit/nav-link-integrity.test.ts.
    const nowLinked = ["/contact", "/faq", "/shipping", "/returns", "/about", "/privacy", "/terms"];
    const links = screen.getAllByRole("link");
    const hrefs = links
      .map((link) => link.getAttribute("href"))
      .filter((href): href is string => href !== null);

    expect(hrefs.length).toBeGreaterThan(0);
    expect(hrefs).toContain("/products");
    expect(hrefs).toContain("/categories");

    for (const route of nowLinked) {
      expect(hrefs).toContain(route);
    }
  });

  it("uses the Ukrainian «Магазин» group's link labels", () => {
    renderWithIntl(<Footer />);
    expect(screen.getByRole("link", { name: "Каталог" })).toHaveAttribute("href", "/products");
    expect(screen.getByRole("link", { name: "Категорії" })).toHaveAttribute("href", "/categories");
    expect(screen.getByRole("link", { name: "Новинки" })).toHaveAttribute(
      "href",
      "/products?sortBy=createdAt&sortOrder=desc"
    );
    expect(screen.getByRole("link", { name: "Зворотний зв'язок" })).toHaveAttribute(
      "href",
      "/feedback"
    );
    expect(screen.getByRole("link", { name: "Статус замовлення" })).toHaveAttribute(
      "href",
      "/track"
    );
  });

  it("invites visitors to follow along on social", () => {
    renderWithIntl(<Footer />);
    expect(screen.getByText("Слідкуйте за нами")).toBeInTheDocument();
  });
});
