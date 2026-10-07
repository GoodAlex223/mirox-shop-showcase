import { screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextIntlClientProvider } from "next-intl";
import type { ReactElement } from "react";
import { renderWithIntl } from "../helpers/render-with-intl";
import uk from "../../messages/uk.json";

vi.mock("@/lib/analytics", () => ({ trackAddToCart: vi.fn() }));

import { QuickViewDialog } from "@/components/products/QuickViewDialog";
import { useCartStore } from "@/stores/cart.store";
import { trackAddToCart } from "@/lib/analytics";

/** Wraps an element for a `rerender()` call: renderWithIntl's own provider
 *  wrapping only applies to the INITIAL render — passing a bare element to
 *  `rerender()` replaces the whole tree (provider included), throwing "no
 *  NextIntlClientProvider context found" (Task 4 finding). Re-wrapping keeps
 *  the provider at the same tree position so React reconciles it as an
 *  update, not a remount — required here since this test's whole point is
 *  same-instance state (isCarouselPaused) surviving a prop change. */
function wrapIntl(ui: ReactElement) {
  return (
    <NextIntlClientProvider locale="uk" messages={uk} timeZone="Europe/Kyiv">
      {ui}
    </NextIntlClientProvider>
  );
}

const product = {
  id: "p1",
  name: "Худі Mirox Basic",
  slug: "hudi-mirox-basic",
  price: "1290",
  comparePrice: null,
  stock: 42,
  category: { name: "Худі", slug: "hudi" },
  images: [{ url: "https://example.com/a.jpg", alt: "front" }],
  variants: [
    { id: "v-s", name: "Розмір", value: "S", stock: 5, price: null },
    { id: "v-m", name: "Розмір", value: "M", stock: 8, price: null },
    { id: "v-black", name: "Колір", value: "Чорний", stock: 30, price: null },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  useCartStore.setState({ items: [], isOpen: false });
});

describe("QuickViewDialog", () => {
  it("requires a size before adding to cart", () => {
    renderWithIntl(<QuickViewDialog product={product} focusSizes={false} onOpenChange={vi.fn()} />);
    const addButton = screen.getByRole("button", { name: /додати в кошик/i });
    expect(addButton).toBeDisabled();
  });

  it("adds the selected size variant to the cart, tracks GA4, opens the drawer", () => {
    const onOpenChange = vi.fn();
    renderWithIntl(<QuickViewDialog product={product} focusSizes onOpenChange={onOpenChange} />);
    fireEvent.click(screen.getByRole("button", { name: "M" }));
    fireEvent.click(screen.getByRole("button", { name: /додати в кошик/i }));

    const items = useCartStore.getState().items;
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      productId: "p1",
      variantId: "v-m",
      name: "Худі Mirox Basic",
      color: "Чорний",
      size: "M",
      price: 1290,
      maxStock: 8,
      quantity: 1,
    });
    expect(useCartStore.getState().isOpen).toBe(true);
    expect(trackAddToCart).toHaveBeenCalledWith(
      expect.objectContaining({ item_id: "p1", item_variant: "M", price: 1290, quantity: 1 })
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("disables out-of-stock size chips", () => {
    const oos = {
      ...product,
      variants: [{ id: "v-s", name: "Розмір", value: "S", stock: 0, price: null }],
    };
    renderWithIntl(<QuickViewDialog product={oos} focusSizes={false} onOpenChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "S" })).toBeDisabled();
  });

  it("allows adding without size selection when the product has no Size variants", () => {
    const sizeless = { ...product, variants: [] };
    renderWithIntl(
      <QuickViewDialog product={sizeless} focusSizes={false} onOpenChange={vi.fn()} />
    );
    fireEvent.click(screen.getByRole("button", { name: /додати в кошик/i }));
    expect(useCartStore.getState().items[0]).toMatchObject({
      productId: "p1",
      variantId: undefined,
      maxStock: 42,
    });
  });

  it("uses the variant price when the variant has its own", () => {
    const priced = {
      ...product,
      variants: [{ id: "v-l", name: "Розмір", value: "L", stock: 3, price: "1390" }],
    };
    renderWithIntl(<QuickViewDialog product={priced} focusSizes={false} onOpenChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "L" }));
    fireEvent.click(screen.getByRole("button", { name: /додати в кошик/i }));
    expect(useCartStore.getState().items[0].price).toBe(1390);
  });

  it("renders a PDP link «Детальніше»", () => {
    renderWithIntl(<QuickViewDialog product={product} focusSizes={false} onOpenChange={vi.fn()} />);
    expect(screen.getByRole("link", { name: /детальніше/i })).toHaveAttribute(
      "href",
      "/products/hudi-mirox-basic"
    );
  });
});

const multiImageProduct = {
  ...product,
  images: [
    { url: "https://example.com/a.jpg", alt: "front" },
    { url: "https://example.com/b.jpg", alt: "back" },
  ],
};

describe("QuickViewDialog — R2 image carousel", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders no arrows for a single-image product", () => {
    renderWithIntl(<QuickViewDialog product={product} focusSizes={false} onOpenChange={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Попереднє фото" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Наступне фото" })).not.toBeInTheDocument();
  });

  it("renders always-visible arrows for a multi-image product and steps manually on click", () => {
    renderWithIntl(
      <QuickViewDialog product={multiImageProduct} focusSizes={false} onOpenChange={vi.fn()} />
    );
    const frontWrapper = screen.getByAltText("front").parentElement!;
    const backWrapper = screen.getByAltText("back").parentElement!;
    expect(frontWrapper.className).toContain("opacity-100");
    expect(backWrapper.className).toContain("opacity-0");

    fireEvent.click(screen.getByRole("button", { name: "Наступне фото" }));

    expect(frontWrapper.className).toContain("opacity-0");
    expect(backWrapper.className).toContain("opacity-100");
  });

  it("auto-advances the visible image while open (fake timers)", () => {
    vi.useFakeTimers();
    renderWithIntl(
      <QuickViewDialog product={multiImageProduct} focusSizes={false} onOpenChange={vi.fn()} />
    );
    const backWrapper = screen.getByAltText("back").parentElement!;
    expect(backWrapper.className).toContain("opacity-0");

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(backWrapper.className).toContain("opacity-100");
  });
});

describe("QuickViewDialog — final-review Fix 2: isCarouselPaused reset", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("resumes autoplay for the next product after closing while an arrow was hovered", () => {
    // Regression for: closing the dialog while the pointer sits over an
    // arrow (which sets isCarouselPaused via onMouseEnter) never fires that
    // arrow's onMouseLeave — it unmounts with the dialog — so pre-fix,
    // isCarouselPaused stayed `true` forever and the next product opened
    // with a permanently-dead carousel.
    vi.useFakeTimers();
    const { rerender } = renderWithIntl(
      <QuickViewDialog product={multiImageProduct} focusSizes={false} onOpenChange={vi.fn()} />
    );
    fireEvent.mouseEnter(screen.getByRole("button", { name: "Наступне фото" }));

    // Close without a mouseleave (parent sets product to null).
    rerender(
      wrapIntl(<QuickViewDialog product={null} focusSizes={false} onOpenChange={vi.fn()} />)
    );

    // Reopen — same product id, mirroring the real "click quick-view on the
    // same card again" path, but the reset fires on any id change (including
    // the close step's transition to null), so this exercises the fix either way.
    rerender(
      wrapIntl(
        <QuickViewDialog product={multiImageProduct} focusSizes={false} onOpenChange={vi.fn()} />
      )
    );

    const backWrapper = screen.getByAltText("back").parentElement!;
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(backWrapper.className).toContain("opacity-100");
  });
});

describe("QuickViewDialog — final-review Fix 5: reduced motion", () => {
  afterEach(() => {
    vi.useRealTimers();
    // @ts-expect-error -- deleting a non-optional global for test cleanup
    delete window.matchMedia;
  });

  it("does not auto-advance under prefers-reduced-motion", () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes("prefers-reduced-motion"),
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    vi.useFakeTimers();
    renderWithIntl(
      <QuickViewDialog product={multiImageProduct} focusSizes={false} onOpenChange={vi.fn()} />
    );
    const backWrapper = screen.getByAltText("back").parentElement!;
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(backWrapper.className).toContain("opacity-0"); // never advanced

    // Manual arrow click still works under reduced motion (only autoplay is gated).
    fireEvent.click(screen.getByRole("button", { name: "Наступне фото" }));
    expect(backWrapper.className).toContain("opacity-100");
  });
});
