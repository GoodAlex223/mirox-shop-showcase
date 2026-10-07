import { describe, it, expect, beforeEach } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithIntl } from "../helpers/render-with-intl";
import { BoughtTogether } from "@/components/products/BoughtTogether";
import { useCartStore } from "@/stores/cart.store";
import type { BundleCompanion } from "@/types";

function companion(over: Partial<BundleCompanion> & { id: string }): BundleCompanion {
  return {
    name: `Product ${over.id}`,
    slug: `product-${over.id}`,
    price: "590",
    comparePrice: null,
    stock: 10,
    image: null,
    category: null,
    colorValue: null,
    sizeVariants: [
      { id: `${over.id}-s`, value: "S", stock: 5, price: null },
      { id: `${over.id}-l`, value: "L", stock: 5, price: null },
    ],
    ...over,
  };
}

const current = companion({
  id: "cur",
  name: "Худі Mirox Basic",
  price: "1290",
  colorValue: "Чорний",
});

beforeEach(() => {
  useCartStore.setState({ items: [], isOpen: false });
});

describe("BoughtTogether", () => {
  it("renders nothing with fewer than 2 companions", () => {
    const { container } = renderWithIntl(
      <BoughtTogether
        current={current}
        companions={[companion({ id: "a" })]}
        preferredSizeValue="L"
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("preselects companions to the preferred size and adds 3 sized lines", () => {
    renderWithIntl(
      <BoughtTogether
        current={current}
        companions={[companion({ id: "a" }), companion({ id: "b" })]}
        preferredSizeValue="L"
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "ДОДАТИ КОМПЛЕКТ У КОШИК" }));
    const items = useCartStore.getState().items;
    expect(items).toHaveLength(3);
    expect(items.every((i) => i.variantId?.endsWith("-l"))).toBe(true);
    expect(items[0].name).toBe("Худі Mirox Basic");
    expect(items[0].size).toBe("L");
    expect(items[0].color).toBe("Чорний");
  });

  it("shows the struck sum only when comparePrices make it genuinely higher", () => {
    renderWithIntl(
      <BoughtTogether
        current={current}
        companions={[companion({ id: "a", comparePrice: "690" }), companion({ id: "b" })]}
        preferredSizeValue="S"
      />
    );
    // total 1290+590+590=2470; compare 1290+690+590=2570. formatPrice emits
    // NON-BREAKING spaces (uk-UA thousands + before грн) — assert via regex.
    expect(screen.getByText(/2[\s ]570[\s ]грн/)).toHaveClass("line-through");
    expect(screen.getByTestId("bundle-total")).toHaveTextContent(/2[\s ]470/);
  });

  it("disables button when current product's preferredSizeValue is out of stock", () => {
    const currentOOS = {
      ...current,
      sizeVariants: [{ id: "cur-s", value: "S", stock: 0, price: null }],
    };
    renderWithIntl(
      <BoughtTogether
        current={currentOOS}
        companions={[companion({ id: "a" }), companion({ id: "b" })]}
        preferredSizeValue="S"
      />
    );
    const button = screen.getByRole("button", { name: "ДОДАТИ КОМПЛЕКТ У КОШИК" });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(useCartStore.getState().items).toHaveLength(0);
  });

  it("disables button when a sizeless companion has zero stock", () => {
    renderWithIntl(
      <BoughtTogether
        current={current}
        companions={[
          companion({ id: "a", sizeVariants: [], stock: 10 }),
          companion({ id: "b", sizeVariants: [], stock: 0 }),
        ]}
        preferredSizeValue="L"
      />
    );
    const button = screen.getByRole("button", { name: "ДОДАТИ КОМПЛЕКТ У КОШИК" });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(useCartStore.getState().items).toHaveLength(0);
  });

  it("adds product-level lines for sizeless companions with stock > 0", () => {
    renderWithIntl(
      <BoughtTogether
        current={current}
        companions={[
          companion({ id: "a", sizeVariants: [], stock: 5 }),
          companion({ id: "b", sizeVariants: [], stock: 3 }),
        ]}
        preferredSizeValue="L"
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "ДОДАТИ КОМПЛЕКТ У КОШИК" }));
    const items = useCartStore.getState().items;
    expect(items).toHaveLength(3);
    // Current product with size
    expect(items[0].name).toBe("Худі Mirox Basic");
    expect(items[0].size).toBe("L");
    expect(items[0].color).toBe("Чорний");
    expect(items[0].variantId).toBe("cur-l");
    // Sizeless companions (no variantId)
    expect(items[1].name).toBe("Product a");
    expect(items[1].variantId).toBeUndefined();
    expect(items[1].maxStock).toBe(5);
    expect(items[2].name).toBe("Product b");
    expect(items[2].variantId).toBeUndefined();
    expect(items[2].maxStock).toBe(3);
  });
});
