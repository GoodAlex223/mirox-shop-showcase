import { describe, it, expect } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithIntl } from "../helpers/render-with-intl";
import { SizePicker } from "@/components/products/SizePicker";

describe("SizePicker", () => {
  it("renders defaults 180/75 → L with Ukrainian copy", () => {
    renderWithIntl(<SizePicker />);
    expect(screen.getByRole("heading", { name: "Підбір розміру" })).toBeInTheDocument();
    expect(screen.getByLabelText(/Зріст/)).toHaveValue(180);
    expect(screen.getByLabelText(/Вага/)).toHaveValue(75);
    expect(screen.getByTestId("recommended-size")).toHaveTextContent("L");
  });

  it("recomputes on input change (192 → XXL)", () => {
    renderWithIntl(<SizePicker />);
    fireEvent.change(screen.getByLabelText(/Зріст/), { target: { value: "192" } });
    expect(screen.getByTestId("recommended-size")).toHaveTextContent("XXL");
  });

  it("falls back to defaults on cleared input", () => {
    renderWithIntl(<SizePicker />);
    fireEvent.change(screen.getByLabelText(/Зріст/), { target: { value: "" } });
    expect(screen.getByTestId("recommended-size")).toHaveTextContent("L");
  });
});
