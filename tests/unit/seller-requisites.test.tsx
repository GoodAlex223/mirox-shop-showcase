import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithIntl } from "../helpers/render-with-intl";

// Controller ruling R3: a `vi.hoisted` box is the mocking mechanism, NOT
// `vi.spyOn(module, "LEGAL_ENTITY", "get")` — you cannot spy a plain value
// property on a module already replaced by a factory.
const box = vi.hoisted(() => ({ entity: null as null | Record<string, string> }));

vi.mock("@/content/legal", () => ({
  get LEGAL_ENTITY() {
    return box.entity;
  },
  RETURN_WINDOW_DAYS: 14,
}));

import { SellerRequisites } from "@/components/pages/SellerRequisites";

describe("<SellerRequisites/>", () => {
  beforeEach(() => {
    box.entity = null;
  });

  it("renders the contact fallback when LEGAL_ENTITY is null", () => {
    renderWithIntl(<SellerRequisites />);
    expect(screen.getByText(/Mirox Shop/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /зворотн/i })).toHaveAttribute("href", "/feedback");
    expect(screen.queryByText(/ЄДРПОУ/)).not.toBeInTheDocument();
  });

  it("renders the requisites table when LEGAL_ENTITY is filled", () => {
    box.entity = {
      form: "ФОП",
      name: "ФОП Тестенко Тест Тестович",
      edrpou: "1234567890",
      address: "м. Київ, вул. Тестова, 1",
    };
    renderWithIntl(<SellerRequisites />);
    expect(screen.getByText("ФОП Тестенко Тест Тестович")).toBeInTheDocument();
    expect(screen.getByText("1234567890")).toBeInTheDocument();
    expect(screen.getByText("м. Київ, вул. Тестова, 1")).toBeInTheDocument();
  });
});
