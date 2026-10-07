import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithIntl } from "../helpers/render-with-intl";
import {
  ProductDetailClient,
  type Product,
} from "@/app/(shop)/products/[slug]/product-detail-client";
import { useCartStore } from "@/stores/cart.store";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));
// ReviewSection pulls next-auth session — stub the whole reviews barrel.
vi.mock("@/components/reviews", () => ({
  ReviewSection: () => <div data-testid="review-section" />,
  StarRating: ({ value }: { value: number }) => <div data-testid="stars">{value}</div>,
}));

function makeProduct(over: Partial<Product> = {}): Product {
  return {
    id: "p1",
    name: "Худі Mirox Basic",
    slug: "hudi-mirox-basic",
    description: "Опис товару",
    shortDesc: null,
    price: "1290",
    comparePrice: null,
    stock: 42,
    sku: "MRX-001",
    isFeatured: false,
    category: { id: "c1", name: "Худі", slug: "hudi" },
    images: [{ id: "i1", url: "/images/products/a.png", alt: null }],
    variants: [
      {
        id: "v-s",
        name: "Розмір",
        value: "S",
        sku: "MRX-001-S",
        price: "1290",
        stock: 3,
        options: {},
      },
      {
        id: "v-l",
        name: "Розмір",
        value: "L",
        sku: "MRX-001-L",
        price: "1290",
        stock: 0,
        options: {},
      },
      {
        id: "v-col",
        name: "Колір",
        value: "Чорний",
        sku: "MRX-001-C",
        price: "1290",
        stock: 30,
        options: {},
      },
    ],
    colorValue: "Чорний",
    styleSiblings: [{ slug: "hudi-mirox-white", name: "Худі Mirox White", colorValue: "Білий" }],
    companions: [],
    relatedProducts: [],
    reviews: [],
    averageRating: 4.5,
    totalReviews: 12,
    ratingDistribution: [],
    ...over,
  };
}

beforeEach(() => {
  useCartStore.setState({ items: [], isOpen: false });
  push.mockClear();
});

describe("ProductDetailClient (TASK-037)", () => {
  it("preselects the first in-stock size and renders UA chrome", () => {
    renderWithIntl(<ProductDetailClient product={makeProduct()} />);
    expect(screen.getByRole("link", { name: "Головна" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Каталог" })).toBeInTheDocument();
    const sizeS = screen.getByRole("button", { name: "S" });
    expect(sizeS).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "L" })).toBeDisabled();
  });

  it("add to cart keeps the line name plain and carries size/color separately (G1 naming revert)", async () => {
    renderWithIntl(<ProductDetailClient product={makeProduct()} />);
    fireEvent.click(screen.getByRole("button", { name: "ДОДАТИ В КОШИК" }));
    await screen.findByRole("button", { name: /ДОДАНО В КОШИК/ });
    const item = useCartStore.getState().items[0];
    expect(item.name).toBe("Худі Mirox Basic");
    expect(item.size).toBe("S");
    expect(item.color).toBe("Чорний");
    expect(item.variantId).toBe("v-s");
  });

  it("«КУПИТИ ЗАРАЗ» adds and navigates to /checkout", async () => {
    renderWithIntl(<ProductDetailClient product={makeProduct()} />);
    fireEvent.click(screen.getByRole("button", { name: "КУПИТИ ЗАРАЗ" }));
    await vi.waitFor(() => expect(push).toHaveBeenCalledWith("/checkout"));
    expect(useCartStore.getState().items).toHaveLength(1);
  });

  it("«КУПИТИ ЗАРАЗ» double-tap adds only one line — busy flag guards against a second addLine", async () => {
    renderWithIntl(<ProductDetailClient product={makeProduct()} />);
    const buyButton = screen.getByRole("button", { name: "КУПИТИ ЗАРАЗ" });
    fireEvent.click(buyButton);
    fireEvent.click(buyButton);
    await vi.waitFor(() => expect(push).toHaveBeenCalled());
    const items = useCartStore.getState().items;
    expect(items).toHaveLength(1);
    expect(items[0].quantity).toBe(1);
    expect(buyButton).toBeDisabled();
  });

  it("sibling colorway renders as a link to its PDP", () => {
    renderWithIntl(<ProductDetailClient product={makeProduct()} />);
    const link = screen.getByRole("link", { name: /Білий — Худі Mirox White/ });
    expect(link).toHaveAttribute("href", "/products/hudi-mirox-white");
  });

  it("active colorway swatch keeps the white active border after tailwind-merge (bg class must also survive)", () => {
    renderWithIntl(<ProductDetailClient product={makeProduct()} />);
    const swatch = screen.getByLabelText("Колір: Чорний (обраний)");
    expect(swatch.className).toContain("border-white");
    expect(swatch.className).toContain("bg-black");
  });

  it("legacy Color variant with no matching sibling renders as a non-link swatch", () => {
    const product = makeProduct({
      colorValue: "Чорний",
      styleSiblings: [],
      variants: [
        {
          id: "v-s",
          name: "Розмір",
          value: "S",
          sku: "MRX-001-S",
          price: "1290",
          stock: 3,
          options: {},
        },
        {
          id: "v-col",
          name: "Колір",
          value: "Чорний",
          sku: "MRX-001-C",
          price: "1290",
          stock: 30,
          options: {},
        },
        {
          id: "v-col-2",
          name: "Колір",
          value: "Білий",
          sku: "MRX-001-C2",
          price: "1290",
          stock: 10,
          options: {},
        },
      ],
    });
    renderWithIntl(<ProductDetailClient product={product} />);
    const swatch = screen.getByLabelText("Колір: Білий");
    expect(swatch.tagName).not.toBe("A");
    expect(swatch.closest("a")).toBeNull();
  });

  it("low stock (≤5) shows «Залишилось N шт», in-stock shows «В наявності»", () => {
    renderWithIntl(<ProductDetailClient product={makeProduct()} />);
    // Selected size S has stock 3.
    expect(screen.getByText("Залишилось 3 шт")).toBeInTheDocument();
  });

  it("fully out-of-stock disables CTAs and shows «Немає в наявності»", () => {
    const product = makeProduct({
      stock: 0,
      variants: [
        { id: "v-s", name: "Розмір", value: "S", sku: "s", price: "1290", stock: 0, options: {} },
      ],
    });
    renderWithIntl(<ProductDetailClient product={product} />);
    expect(screen.getByRole("button", { name: "ДОДАТИ В КОШИК" })).toBeDisabled();
    expect(screen.getByText("Немає в наявності")).toBeInTheDocument();
  });

  it("«N відгуків» anchors to #reviews with uk pluralization", () => {
    renderWithIntl(<ProductDetailClient product={makeProduct()} />);
    const link = screen.getByRole("link", { name: "12 відгуків" });
    expect(link).toHaveAttribute("href", "#reviews");
  });

  it("SizePicker renders for S–XXL products but not for one-size ones (gate revision 2026-08-03)", () => {
    const { unmount } = renderWithIntl(<ProductDetailClient product={makeProduct()} />);
    expect(screen.getByText("Підбір розміру")).toBeInTheDocument();
    unmount();

    const oneSize = makeProduct({
      variants: [
        {
          id: "v-os",
          name: "Розмір",
          value: "Один розмір",
          sku: "MRX-008-OS",
          price: "450",
          stock: 60,
          options: {},
        },
      ],
    });
    renderWithIntl(<ProductDetailClient product={oneSize} />);
    expect(screen.queryByText("Підбір розміру")).not.toBeInTheDocument();
    // The one-size chip still renders (and preselects) in the buy panel.
    expect(screen.getByRole("button", { name: "Один розмір" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });
});
