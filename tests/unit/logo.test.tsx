import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Logo } from "@/components/common/Logo";

describe("Logo", () => {
  it("renders the wordmark by default", () => {
    render(<Logo />);
    expect(screen.getByText("Mirox Shop")).toBeInTheDocument();
  });

  it("hides the wordmark when showText is false", () => {
    render(<Logo showText={false} />);
    expect(screen.queryByText("Mirox Shop")).not.toBeInTheDocument();
  });

  it("exposes an accessible label", () => {
    render(<Logo showText={false} />);
    expect(screen.getByRole("img", { name: "Mirox Shop" })).toBeInTheDocument();
  });
});
