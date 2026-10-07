import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { FadeIn } from "@/components/common/FadeIn";

function mockMatchMedia(matches: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

describe("FadeIn", () => {
  it("renders children visible on first paint (never opacity-0)", () => {
    mockMatchMedia(false);
    render(<FadeIn>Hello</FadeIn>);
    const el = screen.getByText("Hello");
    expect(el).toHaveClass("opacity-100");
    expect(el).not.toHaveClass("opacity-0");
  });

  it("applies the entrance animation when motion is allowed", () => {
    mockMatchMedia(false);
    render(<FadeIn>World</FadeIn>);
    expect(screen.getByText("World")).toHaveClass("animate-fade-up");
  });

  it("omits the entrance animation under reduced motion", () => {
    mockMatchMedia(true);
    render(<FadeIn>Quiet</FadeIn>);
    const el = screen.getByText("Quiet");
    expect(el).toHaveClass("opacity-100");
    expect(el).not.toHaveClass("animate-fade-up");
  });
});
