import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithIntl } from "../helpers/render-with-intl";
import { AdminSidebar } from "@/components/admin";

describe("AdminSidebar (admin.* catalog smoke)", () => {
  it("renders Ukrainian nav labels from the real uk.json catalog", () => {
    renderWithIntl(<AdminSidebar />);
    expect(screen.getByText("Товари")).toBeInTheDocument();
    expect(screen.getByText("Замовлення")).toBeInTheDocument();
    expect(screen.getByText("Постачальники")).toBeInTheDocument();
    expect(screen.getByText("Повернутися до магазину")).toBeInTheDocument();
  });
});
