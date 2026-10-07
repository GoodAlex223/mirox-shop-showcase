import { screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { renderWithIntl } from "../helpers/render-with-intl";
import { ProductRail } from "@/components/home/ProductRail";
import type { ProductCardData } from "@/lib/product-queries";

const products: ProductCardData[] = [
  {
    id: "a",
    name: "Mirox Basic Hoodie",
    slug: "mirox-basic-hoodie",
    shortDesc: null,
    price: "1290.00",
    comparePrice: null,
    stock: 7,
    isFeatured: true,
    category: { name: "Hoodies", slug: "hoodies" },
    images: [{ url: "https://example.com/a.jpg", alt: null }],
    variants: [],
  },
  {
    id: "b",
    name: "Mirox Relaxed Tee",
    slug: "mirox-relaxed-tee",
    shortDesc: null,
    price: "690.00",
    comparePrice: null,
    stock: 12,
    isFeatured: false,
    category: { name: "T-Shirts", slug: "t-shirts" },
    images: [{ url: "https://example.com/b.jpg", alt: null }],
    variants: [],
  },
];

describe("ProductRail", () => {
  it("renders the heading and the view-all link", () => {
    renderWithIntl(
      <ProductRail
        title="Bestsellers"
        products={products}
        viewAllHref="/products?sort=newest"
        viewAllLabel="View all"
      />
    );
    expect(screen.getByRole("heading", { name: "Bestsellers" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /View all/ })).toHaveAttribute(
      "href",
      "/products?sort=newest"
    );
  });

  it("renders a card per product", () => {
    const { container } = renderWithIntl(
      <ProductRail
        title="Featured"
        products={products}
        viewAllHref="/products"
        viewAllLabel="View all"
      />
    );
    // Fixture has two products with distinct names — a fixture of one can't
    // tell "renders a card per product" apart from "renders at most one
    // card", e.g. a stray `.slice(0, 1)` would still pass. Assert both names
    // render AND that the rendered card count matches the input count.
    expect(screen.getByText("Mirox Basic Hoodie")).toBeInTheDocument();
    expect(screen.getByText("Mirox Relaxed Tee")).toBeInTheDocument();
    expect(container.querySelectorAll('[data-testid="product-card"]')).toHaveLength(
      products.length
    );
  });

  it("renders nothing at all when there are no products", () => {
    const { container } = renderWithIntl(
      <ProductRail title="Featured" products={[]} viewAllHref="/products" viewAllLabel="View all" />
    );
    expect(container).toBeEmptyDOMElement();
  });

  // --- Mobile horizontal-scroll rail (G20) ---
  //
  // Below `sm:` the rail is a horizontal scroller of 160px cards per
  // `Mirox Mobile.dc.html`; at `sm:` and up it is the pre-existing grid.
  // jsdom applies no CSS, so these assert the authored class contract —
  // which is why the third test below compares the bleed against an
  // INDEPENDENTLY READ source (globals.css) rather than restating the
  // component's own string back at itself.

  function renderRail() {
    return renderWithIntl(
      <ProductRail
        title="Новинки"
        products={products}
        viewAllHref="/products"
        viewAllLabel="View all"
      />
    );
  }

  function scroller(container: HTMLElement): HTMLElement {
    const el = container.querySelector<HTMLElement>('[data-testid="product-rail-scroller"]');
    if (!el) throw new Error("rail scroller not found");
    return el;
  }

  it("scrolls horizontally below sm: and reverts to the grid at sm:", () => {
    const { container } = renderRail();
    const classes = scroller(container).className.split(/\s+/);

    // Mobile mode.
    expect(classes).toContain("flex");
    expect(classes).toContain("overflow-x-auto");
    // Desktop mode — the grid the rail has always had, unchanged.
    expect(classes).toContain("sm:grid");
    expect(classes).toContain("sm:overflow-visible");
    expect(classes).toContain("sm:grid-cols-2");
    expect(classes).toContain("md:grid-cols-3");
    expect(classes).toContain("lg:grid-cols-4");
  });

  it("gives every card a fixed-width wrapper that releases at sm:", () => {
    const { container } = renderRail();
    const cards = container.querySelectorAll('[data-testid="product-card"]');
    expect(cards).toHaveLength(products.length);

    // Every card, not just the first — a wrapper applied to one card would
    // otherwise pass while the rest collapse to content width.
    for (const card of cards) {
      const wrapper = card.closest('[data-testid="product-rail-item"]');
      expect(wrapper).not.toBeNull();
      const classes = wrapper!.className.split(/\s+/);
      expect(classes).toContain("w-40"); // 160px, the mockup's card width
      expect(classes).toContain("shrink-0");
      expect(classes).toContain("sm:w-auto");
    }
  });

  it("bleeds right by exactly the container's own horizontal padding", () => {
    // A negative margin must be paired with an equal padding, and that pair
    // must equal the `.container` inset it is cancelling — otherwise the
    // rail either clips early or overhangs. Both halves are read here: the
    // component's classes, and the padding value from globals.css. Restating
    // the component's own literal would be an assertion that cannot fail.
    const css = readFileSync("src/app/globals.css", "utf8");
    const containerRule = css.match(/\.container\s*{([^}]*)}/);
    expect(containerRule).not.toBeNull();
    const basePadding = containerRule![1].match(/(?:^|\s)px-(\d+)/);
    expect(basePadding, "`.container` must declare an unprefixed px-N").not.toBeNull();
    const inset = basePadding![1];

    const { container } = renderRail();
    const railClasses = scroller(container).className.split(/\s+/);

    expect(railClasses).toContain(`-mr-${inset}`);
    expect(railClasses).toContain(`pr-${inset}`);
    // ...and both are cancelled together at the breakpoint, so the grid mode
    // inherits no stray offset.
    expect(railClasses).toContain("sm:mr-0");
    expect(railClasses).toContain("sm:pr-0");
  });
});
