import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderWithIntl } from "../helpers/render-with-intl";

vi.mock("@/i18n/actions", () => ({ setLocale: vi.fn() }));

import { LocaleSwitcher } from "@/components/common/LocaleSwitcher";
import { setLocale } from "@/i18n/actions";

beforeEach(() => vi.clearAllMocks());

describe("LocaleSwitcher", () => {
  it("renders both locale buttons with the UA one active (current locale disabled)", () => {
    renderWithIntl(<LocaleSwitcher />);
    expect(screen.getByTestId("locale-switcher-uk")).toBeDisabled();
    expect(screen.getByTestId("locale-switcher-ru")).toBeEnabled();
    expect(screen.getByTestId("locale-switcher-uk")).toHaveTextContent("UA");
    expect(screen.getByTestId("locale-switcher-ru")).toHaveTextContent("RU");
  });

  it("labels the group in the active language for a11y", () => {
    renderWithIntl(<LocaleSwitcher />);
    expect(screen.getByRole("group", { name: "Мова" })).toBeInTheDocument();
  });

  it("calls the setLocale action with ru on click", () => {
    renderWithIntl(<LocaleSwitcher />);
    fireEvent.click(screen.getByTestId("locale-switcher-ru"));
    expect(setLocale).toHaveBeenCalledWith("ru");
  });
});
