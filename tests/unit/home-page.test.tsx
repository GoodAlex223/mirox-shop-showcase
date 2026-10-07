import { screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderWithIntl } from "../helpers/render-with-intl";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
// HomePage is a server component: it calls these query functions directly
// (not via props), so they must be mocked here to avoid a real Prisma/DB call
// in a unit test — same convention as the API route test files (e.g.
// reviews-api.test.ts mocking @/lib/db before importing the route handlers).

vi.mock("@/lib/product-queries", () => ({
  getNewArrivals: vi.fn(),
}));

vi.mock("@/lib/review-queries", () => ({
  getTestimonials: vi.fn(),
}));

import { getNewArrivals, type ProductCardData } from "@/lib/product-queries";
import { getTestimonials } from "@/lib/review-queries";
import HomePage from "@/app/(shop)/page";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function product(id: string): ProductCardData {
  return {
    id,
    name: `Product ${id}`,
    slug: `product-${id}`,
    shortDesc: null,
    price: "999.00",
    comparePrice: null,
    stock: 5,
    isFeatured: true,
    category: { name: "Hoodies", slug: "hoodies" },
    images: [{ url: "https://example.com/x.jpg", alt: null }],
    variants: [],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getNewArrivals).mockResolvedValue([
    product("n1"),
    product("n2"),
    product("n3"),
    product("n4"),
  ]);
  vi.mocked(getTestimonials).mockResolvedValue([]);
});

/**
 * HomePage is an async server component, not a hook or client component: it
 * can be awaited directly to resolve the JSX tree it returns (the same thing
 * Next's own RSC renderer does under the hood), then handed to `render()`.
 * `render(<HomePage />)` would instead hand ReactDOM an unresolved Promise as
 * a child, which is not a case plain `react-dom` (used here via jsdom) knows
 * how to render.
 */
describe("HomePage new-arrivals rail", () => {
  it("renders the Новинки rail with the 4 mocked products and a view-all link to /products", async () => {
    renderWithIntl(await HomePage());

    expect(screen.getByRole("heading", { name: "Новинки" })).toBeInTheDocument();
    expect(screen.getByText("Product n1")).toBeInTheDocument();
    expect(screen.getByText("Product n2")).toBeInTheDocument();
    expect(screen.getByText("Product n3")).toBeInTheDocument();
    expect(screen.getByText("Product n4")).toBeInTheDocument();

    const viewAllLinks = screen.getAllByRole("link", { name: /Дивитись все/ });
    expect(viewAllLinks.some((link) => link.getAttribute("href") === "/products")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Resilience
// ---------------------------------------------------------------------------
// A single section's data query throwing (e.g. the production `reviews` table
// missing, which is what caused the real homepage outage) must degrade to a
// missing section, never a 500 for the whole page. Before safeSection() wrapped
// the queries, a rejected getTestimonials() rejected Promise.all and threw out
// of HomePage() — `await HomePage()` below would reject and fail these tests,
// which is the mutation guard: remove a wrapper and the matching case fails.
describe("HomePage resilience", () => {
  it("still renders the page when getTestimonials() rejects (the real outage)", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(getTestimonials).mockRejectedValue(
      new Error("The table `public.reviews` does not exist in the current database.")
    );

    renderWithIntl(await HomePage());

    // Rest of the page is intact; the testimonials section simply doesn't mount.
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("СТИЛЬ.");
    expect(screen.getByRole("heading", { name: "Чому обирають нас" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Відгуки покупців" })).not.toBeInTheDocument();
    // The failure is logged, not swallowed silently.
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("still renders the page when getNewArrivals() rejects", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(getNewArrivals).mockRejectedValue(new Error("db down"));
    vi.mocked(getTestimonials).mockResolvedValue([
      {
        id: "t1",
        rating: 5,
        comment: "Great fit and fast shipping.",
        authorName: "Nadiya",
        productName: "Product f1",
        productSlug: "product-f1",
        createdAt: "2026-06-10T00:00:00.000Z",
      },
    ]);

    renderWithIntl(await HomePage());

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("СТИЛЬ.");
    expect(screen.getByRole("heading", { name: "Відгуки покупців" })).toBeInTheDocument();
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});

describe("HomePage composition", () => {
  it("renders the benefit strip titles", async () => {
    renderWithIntl(await HomePage());

    expect(screen.getByText("Швидка доставка")).toBeInTheDocument();
    expect(screen.getByText("Преміум якість")).toBeInTheDocument();
    expect(screen.getByText("Підтримка 24/7")).toBeInTheDocument();
    expect(screen.getByText("Оплата при отриманні")).toBeInTheDocument();
  });

  it("renders Hero, WhyChooseUs, and Testimonials as part of the page", async () => {
    vi.mocked(getTestimonials).mockResolvedValue([
      {
        id: "t1",
        rating: 5,
        comment: "Great fit and fast shipping.",
        authorName: "Nadiya",
        productName: "Product f1",
        productSlug: "product-f1",
        createdAt: "2026-06-10T00:00:00.000Z",
      },
    ]);

    renderWithIntl(await HomePage());

    // Hero renders the real src/content/home.ts copy (this file never mocks
    // @/content/home) as the page's only h1 — every other section heading
    // below is an h2.
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("СТИЛЬ.");

    // WhyChooseUs: its own heading, real content.
    expect(screen.getByRole("heading", { name: "Чому обирають нас" })).toBeInTheDocument();

    // Testimonials only renders once getTestimonials() resolves real reviews
    // (see Testimonials.tsx) — asserting its heading and the review's author
    // both prove the section mounted, not just that the mock was called.
    expect(screen.getByRole("heading", { name: "Відгуки покупців" })).toBeInTheDocument();
    expect(screen.getByText("Nadiya")).toBeInTheDocument();
  });
});
