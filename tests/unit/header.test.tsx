import { screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderWithIntl } from "../helpers/render-with-intl";

vi.mock("next-auth/react", () => ({
  useSession: () => ({ data: null, status: "unauthenticated" }),
  signOut: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/",
}));
vi.mock("@/stores/cart.store", () => ({
  useCartStore: () => ({
    items: [{ id: "1", quantity: 2 }],
    openCart: vi.fn(),
    getTotalItems: () => 2,
  }),
}));

import { Header } from "@/components/common/Header";

beforeEach(() => {
  global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [] }) });
});

describe("Header", () => {
  it("renders the client logo image, not the code-drawn wordmark", () => {
    renderWithIntl(<Header />);
    expect(screen.getAllByAltText("Mirox Shop").length).toBeGreaterThan(0);
  });

  it("renders the four resolvable Ukrainian nav links (and none to unbuilt pages)", () => {
    renderWithIntl(<Header />);
    expect(screen.getByRole("link", { name: "Каталог" })).toHaveAttribute("href", "/products");
    expect(screen.getByRole("link", { name: "Новинки" })).toHaveAttribute(
      "href",
      "/products?sort=new"
    );
    expect(screen.getByRole("link", { name: "Бестселери" })).toHaveAttribute(
      "href",
      "/products?sort=popular"
    );
    // «Контакти» joined the header nav in G23 (TASK-055 Task 8) — the /contact
    // page it links to now exists. Design spec §4's six-item nav is
    // deliberately NOT followed in full (§7 of the design doc): «Про нас» and
    // «Доставка» stay footer-only to keep the desktop nav inside the `md`
    // breakpoint for 768–1023px tablets.
    expect(screen.getByRole("link", { name: "Контакти" })).toHaveAttribute("href", "/contact");
    expect(screen.getByRole("link", { name: "Категорії" })).toHaveAttribute("href", "/categories");
    for (const dead of ["Про нас", "Доставка"]) {
      expect(screen.queryByRole("link", { name: dead })).not.toBeInTheDocument();
    }
  });

  it("labels the search trigger for a11y and E2E", () => {
    renderWithIntl(<Header />);
    expect(screen.getByRole("button", { name: "Пошук (Ctrl+K)" })).toBeInTheDocument();
  });
});
