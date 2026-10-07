import { screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Truck } from "lucide-react";
import { renderWithIntl } from "../helpers/render-with-intl";

// Text content (headline, subtitle, CTA labels, image alt) is catalog-sourced
// since TASK-039 G9 — renderWithIntl renders the REAL messages/uk.json, so
// these mirror those real values (hardcoded here, matching the established
// sibling-test convention rather than importing the JSON). Only the
// NON-translatable config surface (eyebrow, image src, CTA hrefs) stays
// mockable below, matching home.ts's trimmed shape.
const HEADLINE1 = "СТИЛЬ. ЯКІСТЬ.";
const HEADLINE2 = "ВПЕВНЕНІСТЬ.";
const PRIMARY_CTA_LABEL = "ПЕРЕЙТИ В КАТАЛОГ";
const SECONDARY_CTA_LABEL = "ПЕРЕГЛЯНУТИ НОВИНКИ";
const IMAGE_ALT = "Модель у чорному худі Mirox";

const defaultHeroImage = { src: "/hero-placeholder-ai.jpg" };

const mockHero = {
  eyebrow: "NEW COLLECTION" as string | null,
  primaryCta: { href: "/products" },
  secondaryCta: { href: "/products?sort=newest" },
  image: defaultHeroImage as { src: string } | null,
};

vi.mock("@/content/home", () => ({
  home: {
    get hero() {
      return mockHero;
    },
    benefits: [{ icon: Truck }],
  },
}));

import { Hero } from "@/components/home/Hero";

// mockHero.image is mutated by the two tests below to exercise both hero
// layouts. Reset it before every test (same precedent as AnnouncementBar's
// mockSite reset) so the outcome never depends on run order — e.g. a failed
// assertion inside "still renders a complete hero..." must not leave `image`
// as null for whatever test happens to run next.
beforeEach(() => {
  mockHero.image = defaultHeroImage;
  mockHero.eyebrow = "NEW COLLECTION";
});

describe("Hero", () => {
  it("renders both slogan lines", () => {
    renderWithIntl(<Hero />);
    expect(screen.getByText(HEADLINE1)).toBeInTheDocument();
    expect(screen.getByText(HEADLINE2)).toBeInTheDocument();
  });

  it("renders the slogan as a single h1 for document outline", () => {
    renderWithIntl(<Hero />);
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent(HEADLINE1);
    expect(heading).toHaveTextContent(HEADLINE2);
  });

  it("renders both CTAs pointing at the briefed destinations", () => {
    renderWithIntl(<Hero />);
    expect(screen.getByRole("link", { name: PRIMARY_CTA_LABEL })).toHaveAttribute(
      "href",
      "/products"
    );
    expect(screen.getByRole("link", { name: SECONDARY_CTA_LABEL })).toHaveAttribute(
      "href",
      "/products?sort=newest"
    );
  });

  it("relies on the dark default surface (no data-surface attribute)", () => {
    const { container } = renderWithIntl(<Hero />);
    expect(container.querySelector("[data-surface]")).toBeNull();
  });

  it("renders the photo when one is configured", () => {
    mockHero.image = defaultHeroImage;
    renderWithIntl(<Hero />);
    expect(screen.getByAltText(IMAGE_ALT)).toBeInTheDocument();
  });

  it("still renders a complete hero when no photo is configured", () => {
    mockHero.image = null;
    renderWithIntl(<Hero />);
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: PRIMARY_CTA_LABEL })).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("shows the ghosted brand watermark only in the no-photo hero", () => {
    // Not `rerender()`: renderWithIntl wraps Hero in NextIntlClientProvider,
    // and RTL's rerender() replaces the ENTIRE previously-rendered tree with
    // whatever element it's given — passing bare `<Hero />` to it would drop
    // the provider wrapper and throw "no NextIntlClientProvider context
    // found". unmount + a fresh renderWithIntl() call re-establishes it.
    mockHero.image = null;
    const first = renderWithIntl(<Hero />);
    expect(screen.getByTestId("hero-watermark")).toBeInTheDocument();
    first.unmount();

    // With a photo, the art-directed backdrop (and its watermark) gives way to
    // the two-column image layout.
    mockHero.image = defaultHeroImage;
    renderWithIntl(<Hero />);
    expect(screen.queryByTestId("hero-watermark")).not.toBeInTheDocument();
  });

  it("staggers the headline lines with an entrance animation", () => {
    renderWithIntl(<Hero />);
    const lines = [HEADLINE1, HEADLINE2].map((t) => screen.getByText(t));
    lines.forEach((el) => expect(el).toHaveClass("animate-fade-up"));
    // Per-line delay must actually increase, or it isn't a stagger — a
    // regression that flattened all lines to one delay would pass a
    // class-only check but fail here.
    expect(lines.map((el) => el.style.animationDelay)).toEqual(["0ms", "90ms"]);
  });

  it("renders the vignette overlay above the hero photo", () => {
    mockHero.image = { src: "/images/hero-model-2.png" };
    renderWithIntl(<Hero />);
    const vignette = screen.getByTestId("hero-vignette");
    expect(vignette).toHaveAttribute("aria-hidden", "true");
    expect(vignette.className).toContain("pointer-events-none");
  });

  it("no longer renders the benefit strip inside the hero", () => {
    renderWithIntl(<Hero />);
    expect(screen.queryByText("Швидка доставка")).not.toBeInTheDocument();
  });

  it("renders the eyebrow row when one is configured", () => {
    renderWithIntl(<Hero />);
    expect(screen.getByText("NEW COLLECTION")).toBeInTheDocument();
  });

  it("renders no eyebrow row when eyebrow is null, in both hero layouts", () => {
    // unmount + fresh renderWithIntl(), not rerender() — see the watermark
    // test above for why.
    mockHero.eyebrow = null;
    const first = renderWithIntl(<Hero />);
    expect(screen.queryByText("NEW COLLECTION")).not.toBeInTheDocument();
    first.unmount();

    mockHero.image = null;
    renderWithIntl(<Hero />);
    expect(screen.queryByText("NEW COLLECTION")).not.toBeInTheDocument();
    // The rest of the no-photo hero still renders around the missing eyebrow.
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
  });
});
