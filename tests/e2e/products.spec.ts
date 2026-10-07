import { test, expect } from "@playwright/test";

test.describe("Product Browsing", () => {
  test("products page displays product grid", async ({ page }) => {
    await page.goto("/products");

    // Wait for products to load
    await page.waitForSelector("[data-testid='product-card']");

    // Should have at least one product
    const products = page.locator("[data-testid='product-card']").first();
    await expect(products).toBeVisible();
  });

  test("can filter products by search", async ({ page }) => {
    await page.goto("/products");

    // Wait for the product grid before interacting with the form. Cards are
    // rendered by a client-side effect (fetchProducts) that only runs after
    // React has hydrated, so their presence is a reliable hydration signal —
    // unlike isVisible() below, which only proves the element has painted.
    // On WebKit specifically, filling an input before hydration produces an
    // `input` event that never reaches React (state stays empty), so a
    // pre-hydration fill() silently no-ops. See BACKLOG.md TASK-038a entry.
    await page.waitForSelector("[data-testid='product-card']");

    // Search moved to the Header dialog in TASK-036 (the catalog filter bar
    // has no search input, per the Mirox mock).
    await page.getByRole("button", { name: "Пошук" }).first().click();
    const searchInput = page.getByPlaceholder(/пошук/i);
    await searchInput.fill("test");
    await searchInput.press("Enter");
    await page.waitForURL(/search=test/, { timeout: 15000 });
    await expect(page).toHaveURL(/search=test/);
  });

  test("can sort products", async ({ page, isMobile }) => {
    await page.goto("/products");
    await page.waitForSelector("[data-testid='product-card']");

    // R5: below md the inline "Сортування" row is CSS-hidden — sort now
    // lives only inside the «Фільтри» sheet's own Сортування section.
    // Scope the click to the sheet (role="dialog") since the hidden inline
    // row's buttons are still present in the DOM (just not visible) and
    // share the same accessible names.
    if (isMobile) {
      await page.getByRole("button", { name: "Фільтри" }).click();
      const sheet = page.getByRole("dialog");
      await Promise.all([
        page.waitForURL(/sort=price-asc/, { timeout: 15000 }),
        sheet.getByRole("button", { name: "Ціна ↑" }).click(),
      ]);
    } else {
      await Promise.all([
        page.waitForURL(/sort=price-asc/, { timeout: 15000 }),
        page.getByRole("button", { name: "Ціна ↑" }).click(),
      ]);
    }

    await page.waitForSelector("[data-testid='product-card']");
    await expect(page).toHaveURL(/sort=price-asc/);
  });

  test("size filter chip updates URL and grid", async ({ page, isMobile }) => {
    await page.goto("/products");
    await page.waitForSelector("[data-testid='product-card']");

    // R5: below md the inline size chip row is CSS-hidden — same "M" name
    // exists twice in the DOM (hidden inline row + sheet row), so the mobile
    // branch opens the sheet first and scopes the click to it.
    if (isMobile) {
      await page.getByRole("button", { name: "Фільтри" }).click();
      const sheet = page.getByRole("dialog");
      await Promise.all([
        page.waitForURL(/size=M/, { timeout: 15000 }),
        sheet.getByRole("button", { name: "M", exact: true }).click(),
      ]);
    } else {
      await Promise.all([
        page.waitForURL(/size=M/, { timeout: 15000 }),
        page.getByRole("button", { name: "M", exact: true }).first().click(),
      ]);
    }

    await page.waitForSelector("[data-testid='product-card']");
  });

  test("can view product details", async ({ page }) => {
    await page.goto("/products");

    // Wait for products to load
    await page.waitForSelector("[data-testid='product-card']");

    // Click the product name inside the first card's link, not a blind
    // center-of-card click: the whole card is one <a>, but ProductCard's
    // desktop hover overlay (quick-view/quick-buy buttons) absolutely
    // covers the image area and legitimately becomes pointer-events-auto
    // once the mouse actually hovers there — same as a real user's cursor
    // would trigger it. Playwright's default click point is the bounding
    // box's geometric center, which for this card layout lands inside the
    // image, right where those buttons sit, so it would hover-reveal and
    // then click the button instead of navigating. The heading text sits
    // in CardContent, below the image, outside the overlay's aspect-square
    // footprint (see ProductCard.tsx) — clicking there is unambiguously
    // "click the product link," bubbling up to the enclosing <a>.
    const productCard = page.locator("[data-testid='product-card']").first();
    await productCard.getByRole("heading").click();

    // Should be on product detail page
    await expect(page).toHaveURL(/\/products\/[^/]+$/);

    // Product details should be visible
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("product detail shows price", async ({ page }) => {
    await page.goto("/products");

    // Navigate to first product — see the comment on "can view product
    // details" above for why this clicks the heading rather than the card.
    await page.locator("[data-testid='product-card']").first().getByRole("heading").click();

    // Wait for product page to load
    await expect(page).toHaveURL(/\/products\/[^/]+$/);

    // Price should be visible (use first match since there may be multiple prices)
    await expect(page.getByText(/\d[\s ]?грн/).first()).toBeVisible();
  });

  test("product detail shows add to cart button", async ({ page }) => {
    await page.goto("/products");

    // Wait for products and navigate to first product
    await page.waitForSelector("[data-testid='product-card']");
    await page.locator("[data-testid='product-card']").first().getByRole("heading").click();

    // Wait for product page to load
    await expect(page).toHaveURL(/\/products\/[^/]+$/);
    await page.waitForSelector('[data-hydrated="true"]');

    // Add to cart button should be visible
    const addToCartButton = page.getByRole("button", { name: /^додати в кошик$/i });
    await expect(addToCartButton).toBeVisible();
  });

  test("PDP adds a sized cart line (variant value, not dimension name)", async ({ page }) => {
    await page.goto("/products/hudi-mirox-basic");
    await page.waitForSelector('[data-hydrated="true"]');

    // First in-stock size (S) is preselected — add straight away.
    await page.getByRole("button", { name: /^додати в кошик$/i }).click();
    await expect(page.getByRole("button", { name: /додано в кошик/i })).toBeVisible();

    // The drawer line must carry the VALUE («Розмір: S»), never «— Size».
    await page
      .getByRole("button", { name: /кошик|cart/i })
      .first()
      .click();
    // Scoped to the open drawer (Radix Sheet, role="dialog") — the PDP behind
    // it also renders "Худі Mirox Basic" (breadcrumb/title) and BoughtTogether
    // renders "Розмір: S" for the current product, so page-wide assertions
    // here would still pass even if the drawer's own variant line were deleted.
    const drawer = page.getByRole("dialog");
    await expect(drawer.getByText("Худі Mirox Basic", { exact: true }).first()).toBeVisible();
    await expect(drawer.getByText(/Розмір: S/).first()).toBeVisible();
    await expect(page.getByText(/— Size/)).toHaveCount(0);
  });

  test("PDP colorway swatch navigates to the sibling product", async ({ page }) => {
    await page.goto("/products/hudi-mirox-basic");
    await page.waitForSelector('[data-hydrated="true"]');
    await page.getByRole("link", { name: /Білий — Худі Mirox White/ }).click();
    await expect(page).toHaveURL(/\/products\/hudi-mirox-white$/);

    // PR #27 review: soft nav reuses the route template, so without a remount
    // key the sibling PDP kept the previous product's selectedSizeId — no size
    // preselected, and add-to-cart produced a variantId-less, maxStock-0 line.
    // The remount must preselect the sibling's own first in-stock size…
    // (wait for the sibling's h1 first: until the new tree renders, the OLD
    // instance's data-hydrated node is still attached and would satisfy the
    // selector while the new instance is pre-hydration — WebKit drops clicks
    // landing in that window)
    await expect(page.locator("h1")).toHaveText("Худі Mirox White");
    await page.waitForSelector('[data-hydrated="true"]');
    // .first(): the buy panel's size chip; BoughtTogether companions render
    // their own "S" chips further down.
    await expect(page.getByRole("button", { name: "S", exact: true }).first()).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    // …and add-to-cart must carry the sibling's real sized line.
    await page.getByRole("button", { name: /^додати в кошик$/i }).click();
    await expect(page.getByRole("button", { name: /додано в кошик/i })).toBeVisible();
    await page
      .getByRole("button", { name: /кошик|cart/i })
      .first()
      .click();
    // Scoped to the open drawer, same rationale as the test above.
    const drawer = page.getByRole("dialog");
    await expect(drawer.getByText("Худі Mirox White", { exact: true }).first()).toBeVisible();
    await expect(drawer.getByText(/Розмір: S/).first()).toBeVisible();
  });
});
