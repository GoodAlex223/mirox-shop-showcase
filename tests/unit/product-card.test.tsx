import { screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { renderWithIntl } from "../helpers/render-with-intl";
import { ProductCard } from "@/components/products/ProductCard";

/**
 * jsdom (this repo's test environment) has no `matchMedia` at all — see
 * tests/unit/fade-in.test.tsx for the same pattern. `hoverCapable`/
 * `reducedMotion` are resolved per query string so a single mock can stand
 * in for both `(hover: hover)` and `(prefers-reduced-motion: reduce)`
 * without one setting leaking into the other's result.
 */
function mockMatchMedia({
  hoverCapable = true,
  reducedMotion = false,
}: { hoverCapable?: boolean; reducedMotion?: boolean } = {}) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query.includes("hover") ? hoverCapable : reducedMotion,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

const base = {
  id: "p1",
  name: "Mirox Hoodie",
  slug: "mirox-hoodie",
  price: 39.99,
  comparePrice: 49.99,
  stock: 5,
  images: [{ url: "https://example.com/a.jpg", alt: "Hoodie" }],
  category: { name: "Hoodies", slug: "hoodies" },
};

describe("ProductCard", () => {
  it("renders the discount badge with the handoff pill classes, no destructive/red class", () => {
    const { container } = renderWithIntl(<ProductCard product={base} />);
    const badge = screen.getByText("-20%");
    expect(badge.className).toContain("bg-secondary");
    expect(badge.className).toContain("border-border-strong");
    expect(badge.className).toContain("rounded-full");
    expect(badge.className).toContain("text-foreground");
    // No element on the card uses the destructive (red) badge variant.
    expect(container.querySelector(".bg-destructive")).toBeNull();
  });

  it("shows the branded fallback when an image fails to load", () => {
    renderWithIntl(<ProductCard product={base} />);
    const img = screen.getByAltText("Hoodie");
    fireEvent.error(img);
    expect(screen.getByTestId("product-image-fallback")).toBeInTheDocument();
  });

  it("shows the branded fallback when no image is provided", () => {
    renderWithIntl(<ProductCard product={{ ...base, images: [] }} />);
    expect(screen.getByTestId("product-image-fallback")).toBeInTheDocument();
  });

  it("renders the whole card as a single link, with no separate View Product/Details button", () => {
    renderWithIntl(<ProductCard product={base} />);
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute("href", "/products/mirox-hoodie");
    expect(screen.queryByText(/View Product/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/View Details/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("gives the whole-card link an accessible name equal to just the product name", () => {
    renderWithIntl(<ProductCard product={base} />);
    // aria-label overrides the link's nested text content (category, price,
    // size row, ...) as its accessible name — this specifically proves a
    // screen reader announces "Mirox Hoodie", not the entire card's text.
    const link = screen.getByRole("link", { name: base.name });
    expect(link).toHaveAttribute("href", "/products/mirox-hoodie");
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });

  it("renders the whole card as a single link even when out of stock", () => {
    // comparePrice cleared: TASK-036's single-badge precedence (discount >
    // НОВИНКА > out-of-stock) would otherwise show the discount badge
    // instead of the out-of-stock label this test is asserting on.
    renderWithIntl(<ProductCard product={{ ...base, stock: 0, comparePrice: null }} />);
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.getByText("Немає в наявності")).toBeInTheDocument();
  });

  it("renders deduped Size-variant values in canonical S/M/L/XL/XXL order", () => {
    renderWithIntl(
      <ProductCard
        product={{
          ...base,
          variants: [
            { name: "Розмір", value: "L" },
            { name: "Розмір", value: "S" },
            { name: "Розмір", value: "XL" },
            { name: "Розмір", value: "S" }, // duplicate — must not repeat in the row
            { name: "Колір", value: "White" }, // non-Розмір — must not appear in the row
          ],
        }}
      />
    );
    expect(screen.getByText("S · L · XL")).toBeInTheDocument();
    expect(screen.queryByText(/White/)).not.toBeInTheDocument();
  });

  it("renders no sizes row when variants are absent", () => {
    renderWithIntl(<ProductCard product={base} />);
    expect(screen.queryByText(/·/)).not.toBeInTheDocument();
  });

  it("renders no sizes row when variants exist but none are Size", () => {
    renderWithIntl(
      <ProductCard product={{ ...base, variants: [{ name: "Колір", value: "Чорний" }] }} />
    );
    expect(screen.queryByText(/·/)).not.toBeInTheDocument();
  });
});

const now = Date.now();
const DAY_MS = 24 * 60 * 60 * 1000;

describe("ProductCard — TASK-036 upgrades", () => {
  it("shows НОВИНКА for a fresh product without discount", () => {
    renderWithIntl(
      <ProductCard
        product={{
          ...base,
          comparePrice: null,
          createdAt: new Date(now - 5 * DAY_MS).toISOString(),
        }}
      />
    );
    expect(screen.getByText("НОВИНКА")).toBeInTheDocument();
  });

  it("discount badge wins over НОВИНКА (one badge max)", () => {
    renderWithIntl(
      <ProductCard product={{ ...base, createdAt: new Date(now - 5 * DAY_MS).toISOString() }} />
    );
    expect(screen.getByText("-20%")).toBeInTheDocument();
    expect(screen.queryByText("НОВИНКА")).not.toBeInTheDocument();
  });

  it("renders no НОВИНКА badge for an old product", () => {
    renderWithIntl(
      <ProductCard
        product={{
          ...base,
          comparePrice: null,
          createdAt: new Date(now - 60 * DAY_MS).toISOString(),
        }}
      />
    );
    expect(screen.queryByText("НОВИНКА")).not.toBeInTheDocument();
  });

  it("renders display-only colour swatches from Color variants", () => {
    renderWithIntl(
      <ProductCard
        product={{
          ...base,
          variants: [
            { name: "Колір", value: "Чорний" },
            { name: "Колір", value: "Білий" },
            { name: "Колір", value: "Чорний" }, // duplicate — one swatch only
          ],
        }}
      />
    );
    expect(screen.getByLabelText("Колір: Чорний")).toBeInTheDocument();
    expect(screen.getByLabelText("Колір: Білий")).toBeInTheDocument();
    expect(screen.getAllByLabelText(/^Колір:/)).toHaveLength(2);
  });

  it("renders quick-action buttons only when onQuickView is provided", () => {
    const onQuickView = vi.fn();
    renderWithIntl(<ProductCard product={base} onQuickView={onQuickView} />);
    fireEvent.click(screen.getByRole("button", { name: "Швидкий перегляд" }));
    expect(onQuickView).toHaveBeenCalledWith({ focusSizes: false });
    fireEvent.click(screen.getByRole("button", { name: "В кошик" }));
    expect(onQuickView).toHaveBeenCalledWith({ focusSizes: true });
    // still a single link — buttons are siblings of the anchor, not nested in it
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });

  it("keeps quick-action buttons pointer-events-none until hover/focus-within makes the overlay visible", () => {
    // Regression test (Task 10 E2E finding): an unconditional
    // pointer-events-auto on these buttons let the invisible (opacity-0)
    // overlay sit on top of the card's <a> and intercept clicks meant for
    // the product link — reproduced via Playwright as "subtree intercepts
    // pointer events" on the "can view product details" E2E test. jsdom
    // doesn't do real hit-testing, so this asserts the class contract
    // directly: pointer-events must start "none" and only flip to "auto"
    // via the group-hover/group-focus-within variants that also drive the
    // overlay's opacity, never as a bare unconditional utility.
    renderWithIntl(<ProductCard product={base} onQuickView={vi.fn()} />);
    for (const name of ["Швидкий перегляд", "В кошик"]) {
      const classes = screen.getByRole("button", { name }).className.split(/\s+/);
      expect(classes).not.toContain("pointer-events-auto");
      expect(classes).toContain("pointer-events-none");
      expect(classes).toContain("group-hover:pointer-events-auto");
      expect(classes).toContain("group-focus-within:pointer-events-auto");
    }
  });

  it("hides «В кошик» (but keeps quick view) when out of stock", () => {
    renderWithIntl(<ProductCard product={{ ...base, stock: 0 }} onQuickView={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Швидкий перегляд" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "В кошик" })).not.toBeInTheDocument();
  });

  it("stops quick-action clicks bubbling to a wrapping click handler (card link area still bubbles)", () => {
    const wrapperClick = vi.fn();
    renderWithIntl(
      <div onClick={wrapperClick}>
        <ProductCard product={base} onQuickView={vi.fn()} />
      </div>
    );

    fireEvent.click(screen.getByRole("button", { name: "Швидкий перегляд" }));
    expect(wrapperClick).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "В кошик" }));
    expect(wrapperClick).not.toHaveBeenCalled();

    // Control assertion: the card's link area is expected to bubble — proves
    // the wrapper's click handler is actually wired up and would have fired
    // for the buttons above if they hadn't stopped propagation.
    fireEvent.click(screen.getByRole("link", { name: base.name }));
    expect(wrapperClick).toHaveBeenCalledTimes(1);
  });

  it("stacks one <img> per product image for the carousel (R2)", () => {
    const two = {
      ...base,
      images: [
        { url: "https://example.com/a.jpg", alt: "front" },
        { url: "https://example.com/b.jpg", alt: "back" },
      ],
    };
    const { unmount } = renderWithIntl(<ProductCard product={two} />);
    expect(screen.getByAltText("back")).toBeInTheDocument();
    expect(screen.getAllByRole("img")).toHaveLength(2);
    unmount();
    renderWithIntl(<ProductCard product={base} />);
    expect(screen.getAllByRole("img")).toHaveLength(1); // single-image product: unchanged
  });
});

describe("ProductCard — R1 equal-height class contract", () => {
  // RTL/jsdom doesn't lay out flexbox, so this can't assert actual pixel
  // heights — it locks in the class contract the fix depends on: the Card
  // root stretches to its CSS Grid track's full height (h-full, backed by
  // flex flex-col), and the Link/CardContent chain propagates that height
  // down so the price row's mt-auto (see the next describe block) has real
  // extra space to consume. See the re-screenshot in the revision report
  // for the actual rendered proof.
  it("gives the card root h-full + flex flex-col", () => {
    renderWithIntl(<ProductCard product={base} />);
    const classes = screen.getByTestId("product-card").className.split(/\s+/);
    expect(classes).toContain("h-full");
    expect(classes).toContain("flex");
    expect(classes).toContain("flex-col");
  });

  it("pins the price row to the bottom via mt-auto, not mt-2", () => {
    // Not queried via the price text itself: formatPrice() joins the amount
    // and "грн" with a non-breaking space, which RTL's default whitespace
    // normalizer collapses to a regular space before matching — comparing
    // against the raw formatPrice() string (still containing  ) would
    // never match. The price row's own class list is the stable target.
    const { container } = renderWithIntl(<ProductCard product={base} />);
    const priceRow = container.querySelector(".mt-auto");
    expect(priceRow).not.toBeNull();
    expect(priceRow!.className).not.toContain("mt-2");
  });
});

describe("ProductCard — R2 image carousel", () => {
  const multi = {
    ...base,
    images: [
      { url: "https://example.com/a.jpg", alt: "front" },
      { url: "https://example.com/b.jpg", alt: "back" },
      { url: "https://example.com/c.jpg", alt: "side" },
    ],
  };

  it("renders no carousel arrows for a single-image product", () => {
    renderWithIntl(<ProductCard product={base} />);
    expect(screen.queryByRole("button", { name: "Попереднє фото" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Наступне фото" })).not.toBeInTheDocument();
  });

  it("renders prev/next arrows for a multi-image product", () => {
    renderWithIntl(<ProductCard product={multi} />);
    expect(screen.getByRole("button", { name: "Попереднє фото" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Наступне фото" })).toBeInTheDocument();
  });

  it("advances the visible image on next-arrow click, without navigating or bubbling to a wrapper handler", () => {
    const wrapperClick = vi.fn();
    renderWithIntl(
      <div onClick={wrapperClick}>
        <ProductCard product={multi} />
      </div>
    );

    const frontWrapper = screen.getByAltText("front").parentElement!;
    const backWrapper = screen.getByAltText("back").parentElement!;
    expect(frontWrapper.className).toContain("opacity-100");
    expect(backWrapper.className).toContain("opacity-0");

    fireEvent.click(screen.getByRole("button", { name: "Наступне фото" }));

    expect(frontWrapper.className).toContain("opacity-0");
    expect(backWrapper.className).toContain("opacity-100");
    expect(wrapperClick).not.toHaveBeenCalled();
  });

  it("steps backward (wrapping to the last image) on prev-arrow click", () => {
    renderWithIntl(<ProductCard product={multi} />);
    const frontWrapper = screen.getByAltText("front").parentElement!;
    const sideWrapper = screen.getByAltText("side").parentElement!;
    expect(frontWrapper.className).toContain("opacity-100");

    fireEvent.click(screen.getByRole("button", { name: "Попереднє фото" }));

    expect(frontWrapper.className).toContain("opacity-0");
    expect(sideWrapper.className).toContain("opacity-100");
  });

  it("keeps arrow buttons pointer-events-none until hover/focus-within reveals the overlay", () => {
    // Same regression contract as the quick-action buttons (Task 10 E2E
    // finding): an unconditional pointer-events-auto would let an invisible
    // arrow intercept clicks meant for the card link beneath it.
    renderWithIntl(<ProductCard product={multi} />);
    for (const name of ["Попереднє фото", "Наступне фото"]) {
      const classes = screen.getByRole("button", { name }).className.split(/\s+/);
      expect(classes).not.toContain("pointer-events-auto");
      expect(classes).toContain("pointer-events-none");
      expect(classes).toContain("group-hover:pointer-events-auto");
      expect(classes).toContain("group-focus-within:pointer-events-auto");
    }
  });
});

describe("ProductCard — fix round 1: hover boundary is the Card root", () => {
  // Fix-round-1 finding: hover tracking used to live on the image div, but
  // the arrows/quick-action buttons are absolutely-positioned DOM SIBLINGS
  // of the Link (stacked visually over the image, structurally not inside
  // it) — so moving the cursor onto an overlay button fired mouseleave on
  // the image div in a real browser and reset the carousel before a click
  // could land. jsdom has no paint/hit-testing model, so it can't reproduce
  // *that* specific browser behavior (a real-browser Playwright check
  // covers it — see the revision-1 report). What these tests DO verify,
  // using real React event-tree semantics that jsdom faithfully implements
  // (containment, not paint order): the mouseenter/mouseleave handlers are
  // bound to the Card root, not the image div, and moving onto a
  // descendant overlay button never fires the Card's mouseleave.
  const multi = {
    ...base,
    images: [
      { url: "https://example.com/a.jpg", alt: "front" },
      { url: "https://example.com/b.jpg", alt: "back" },
    ],
  };

  it("starts autoplay when the Card root itself is entered (not just the image area)", () => {
    vi.useFakeTimers();
    try {
      renderWithIntl(<ProductCard product={multi} />);
      const frontWrapper = screen.getByAltText("front").parentElement!;
      const backWrapper = screen.getByAltText("back").parentElement!;

      // Firing mouseEnter directly on the Card root only reaches a handler
      // that's actually bound there (or an ancestor) — a handler left on
      // the image div (a descendant) would never see this event, so this
      // fails against the pre-fix code.
      fireEvent.mouseEnter(screen.getByTestId("product-card"));
      act(() => {
        vi.advanceTimersByTime(1500);
      });

      expect(frontWrapper.className).toContain("opacity-0");
      expect(backWrapper.className).toContain("opacity-100");
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not reset to image[0] when the cursor moves onto a descendant overlay arrow", () => {
    vi.useFakeTimers();
    try {
      renderWithIntl(<ProductCard product={multi} />);
      const frontWrapper = screen.getByAltText("front").parentElement!;
      const backWrapper = screen.getByAltText("back").parentElement!;

      fireEvent.mouseEnter(screen.getByTestId("product-card"));
      act(() => {
        vi.advanceTimersByTime(1500);
      });
      expect(backWrapper.className).toContain("opacity-100"); // advanced past image[0]

      // The arrow button is a Card descendant (sibling of the Link, not of
      // the image div) — entering it must never look like leaving the Card.
      fireEvent.mouseEnter(screen.getByRole("button", { name: "Наступне фото" }));

      expect(frontWrapper.className).toContain("opacity-0");
      expect(backWrapper.className).toContain("opacity-100"); // still on image[1], not reset
    } finally {
      vi.useRealTimers();
    }
  });

  it("resets to image[0] only when the cursor actually leaves the Card", () => {
    renderWithIntl(<ProductCard product={multi} />);
    const frontWrapper = screen.getByAltText("front").parentElement!;

    fireEvent.click(screen.getByRole("button", { name: "Наступне фото" })); // move off image[0]
    expect(frontWrapper.className).toContain("opacity-0");

    fireEvent.mouseLeave(screen.getByTestId("product-card"));

    expect(frontWrapper.className).toContain("opacity-100"); // back to image[0]
  });
});

describe("ProductCard — R3 quick-buy cart icon", () => {
  it("renders a cart icon (not the former text label) with an accessible name of «В кошик»", () => {
    renderWithIntl(<ProductCard product={base} onQuickView={vi.fn()} />);
    const button = screen.getByRole("button", { name: "В кошик" });
    expect(button).not.toHaveTextContent("В кошик");
    expect(button.querySelector("svg")).toBeInTheDocument();
  });
});

describe("ProductCard — final-review Fix 1: hover-capability gating (not just viewport width)", () => {
  const multi = {
    ...base,
    images: [
      { url: "https://example.com/a.jpg", alt: "front" },
      { url: "https://example.com/b.jpg", alt: "back" },
    ],
  };

  it("gates the quick-action overlay on [@media(hover:hover)]:md:flex, not bare md:flex", () => {
    renderWithIntl(<ProductCard product={base} onQuickView={vi.fn()} />);
    const overlay = screen.getByRole("button", { name: "Швидкий перегляд" }).closest("div")!;
    const classes = overlay.className.split(/\s+/);
    expect(classes).toContain("hidden");
    expect(classes).toContain("[@media(hover:hover)]:md:flex");
    expect(classes).not.toContain("md:flex");
  });

  it("gates the carousel-arrow overlay on [@media(hover:hover)]:md:flex, not bare md:flex", () => {
    renderWithIntl(<ProductCard product={multi} />);
    const overlay = screen.getByRole("button", { name: "Наступне фото" }).closest("div")!;
    const classes = overlay.className.split(/\s+/);
    expect(classes).toContain("hidden");
    expect(classes).toContain("[@media(hover:hover)]:md:flex");
    expect(classes).not.toContain("md:flex");
  });
});

describe("ProductCard — final-review Fix 1 / Fix 5: autoplay gating", () => {
  afterEach(() => {
    // Undo the per-test window.matchMedia stub so later tests in this file
    // (and other files sharing the jsdom window) see the real jsdom default
    // (undefined) again, not a stale mock's captured matches value —
    // vi.clearAllMocks() (tests/setup.tsx) only clears call history, not the
    // assigned implementation.
    // @ts-expect-error -- deleting a non-optional global for test cleanup
    delete window.matchMedia;
  });

  const multi = {
    ...base,
    images: [
      { url: "https://example.com/a.jpg", alt: "front" },
      { url: "https://example.com/b.jpg", alt: "back" },
    ],
  };

  it("does not auto-advance on a non-hover-capable device even after mouseenter", () => {
    mockMatchMedia({ hoverCapable: false });
    vi.useFakeTimers();
    try {
      renderWithIntl(<ProductCard product={multi} />);
      const frontWrapper = screen.getByAltText("front").parentElement!;
      fireEvent.mouseEnter(screen.getByTestId("product-card"));
      act(() => {
        vi.advanceTimersByTime(5000);
      });
      expect(frontWrapper.className).toContain("opacity-100"); // never advanced
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not auto-advance under prefers-reduced-motion even on a hover-capable device", () => {
    mockMatchMedia({ hoverCapable: true, reducedMotion: true });
    vi.useFakeTimers();
    try {
      renderWithIntl(<ProductCard product={multi} />);
      const frontWrapper = screen.getByAltText("front").parentElement!;
      fireEvent.mouseEnter(screen.getByTestId("product-card"));
      act(() => {
        vi.advanceTimersByTime(5000);
      });
      expect(frontWrapper.className).toContain("opacity-100"); // never advanced
    } finally {
      vi.useRealTimers();
    }
  });

  it("still auto-advances on a hover-capable device with no motion preference", () => {
    mockMatchMedia({ hoverCapable: true, reducedMotion: false });
    vi.useFakeTimers();
    try {
      renderWithIntl(<ProductCard product={multi} />);
      const backWrapper = screen.getByAltText("back").parentElement!;
      fireEvent.mouseEnter(screen.getByTestId("product-card"));
      act(() => {
        vi.advanceTimersByTime(1500);
      });
      expect(backWrapper.className).toContain("opacity-100");
    } finally {
      vi.useRealTimers();
    }
  });
});
