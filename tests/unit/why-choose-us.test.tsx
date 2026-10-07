import { screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { renderWithIntl } from "../helpers/render-with-intl";

vi.mock("@/content/site", () => ({
  site: { claims: { olxSales: "300+", instagramOrders: "100+", customerRating: null } },
}));

import { WhyChooseUs } from "@/components/home/WhyChooseUs";

describe("WhyChooseUs", () => {
  it("renders a stat for each configured claim and omits null ones", () => {
    renderWithIntl(<WhyChooseUs />);
    expect(screen.getByText("300+")).toBeInTheDocument();
    expect(screen.getByText("100+")).toBeInTheDocument();
    // customerRating is null → its label must not appear.
    expect(screen.queryByText(/середня оцінка/)).toBeNull();
  });

  it("relies on the dark default surface (no data-surface attribute)", () => {
    const { container } = renderWithIntl(<WhyChooseUs />);
    expect(container.querySelector("[data-surface]")).toBeNull();
  });

  it("renders the supporting brand-voice items", () => {
    renderWithIntl(<WhyChooseUs />);
    expect(screen.getByText("Безпечна оплата")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(6);
  });
});
