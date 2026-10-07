import { screen, within } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import type { Testimonial } from "@/lib/review-queries";
import { renderWithIntl } from "../helpers/render-with-intl";

// No @/content/home mock: the section title is catalog-sourced since
// TASK-039 G9 (home.testimonials.title), and Testimonials.tsx no longer
// imports @/content/home at all — renderWithIntl supplies the real catalog.
import { Testimonials } from "@/components/home/Testimonials";

const testimonials: Testimonial[] = [
  {
    id: "r1",
    rating: 3,
    comment: "Excellent quality, fits perfectly.",
    authorName: "Oleksandr",
    productName: "Mirox Basic Hoodie",
    productSlug: "mirox-basic-hoodie",
    createdAt: "2026-06-01T00:00:00.000Z",
  },
  {
    id: "r2",
    rating: 5,
    comment: "Perfect fit, ordering another one.",
    authorName: "Iryna",
    productName: "Mirox Relaxed Tee",
    productSlug: "mirox-relaxed-tee",
    createdAt: "2026-06-05T00:00:00.000Z",
  },
];

describe("Testimonials", () => {
  it("renders a card per testimonial, each with its own author, product link, and star count", () => {
    const { container } = renderWithIntl(<Testimonials testimonials={testimonials} />);

    // Fixture has two testimonials with distinct ratings/authors — a fixture
    // of one can't tell "renders one card per testimonial" apart from
    // "renders at most one card", e.g. a stray `.slice(0, 1)` would still
    // pass. Assert both the count and each card's own content.
    const cards = container.querySelectorAll('[data-testid="testimonial-card"]');
    expect(cards).toHaveLength(testimonials.length);

    const first = within(cards[0] as HTMLElement);
    expect(first.getByText(/Excellent quality/)).toBeInTheDocument();
    expect(first.getByText("Oleksandr")).toBeInTheDocument();
    expect(first.getByRole("link", { name: /Mirox Basic Hoodie/ })).toHaveAttribute(
      "href",
      "/products/mirox-basic-hoodie"
    );
    // Verify the correct number of stars are filled per card. We count
    // elements with the `fill-rating` class rather than querying by role
    // or text because StarRating uses the same aria-label for all stars
    // regardless of value, so there is no accessible name to distinguish
    // them. Class-based counting is the reliable signal.
    expect(cards[0].querySelectorAll(".fill-rating")).toHaveLength(3);

    const second = within(cards[1] as HTMLElement);
    expect(second.getByText(/Perfect fit/)).toBeInTheDocument();
    expect(second.getByText("Iryna")).toBeInTheDocument();
    expect(second.getByRole("link", { name: /Mirox Relaxed Tee/ })).toHaveAttribute(
      "href",
      "/products/mirox-relaxed-tee"
    );
    expect(cards[1].querySelectorAll(".fill-rating")).toHaveLength(5);
  });

  it("renders nothing when no reviews qualify", () => {
    const { container } = renderWithIntl(<Testimonials testimonials={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders an initial avatar and a uk-UA date for each testimonial", () => {
    renderWithIntl(<Testimonials testimonials={testimonials} />);
    expect(screen.getByText(testimonials[0].authorName[0])).toBeInTheDocument(); // «O» for Oleksandr
    expect(
      screen.getByText(new Date(testimonials[0].createdAt).toLocaleDateString("uk-UA"))
    ).toBeInTheDocument();
  });
});
