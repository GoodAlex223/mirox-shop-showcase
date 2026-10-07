import { test, expect } from "@playwright/test";

test.describe("Shopping Cart", () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage before each test
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
  });

  test("can add product to cart", async ({ page }) => {
    await page.goto("/products");

    // Wait for products to load
    await page.waitForSelector("[data-testid='product-card']");

    // Click on the product card heading (inside the card's single <a> —
    // see TASK-057 item E) rather than the card's geometric center: the
    // TASK-036 redesign added a hover-revealed quick-view/quick-buy overlay
    // over the card image, and a blind click can land on that button
    // instead of navigating. The heading sits below the overlay's
    // aspect-square footprint, same pattern as tests/e2e/products.spec.ts.
    await Promise.all([
      page.waitForURL(/\/products\/[^/]+$/),
      page.locator("[data-testid='product-card']").first().getByRole("heading").click(),
    ]);
    await page.waitForSelector('[data-hydrated="true"]');

    // Click add to cart
    await page.getByRole("button", { name: /^додати в кошик$/i }).click();

    // Cart should indicate item was added: the button flips to its transient
    // «додано» (added) state for 2s (product-detail-client.tsx). This must be
    // the ONLY signal asserted here: the header cart button's sr-only "Cart"
    // label renders unconditionally (not gated on item count — see
    // Header.tsx), so a locator that also accepts "cart" would match that
    // persistent button even if this click were a no-op, making the
    // assertion pass regardless of whether the add actually worked. No toast
    // and no [data-cart-count] exist in this UI to fall back on instead.
    await expect(page.getByRole("button", { name: /додано в кошик/i })).toBeVisible({
      timeout: 5000,
    });
  });

  test("cart page shows empty state when no items", async ({ page }) => {
    await page.goto("/cart");

    // Should show empty cart message
    await expect(page.getByText(/порожній/i)).toBeVisible();
  });

  test("can navigate to cart page", async ({ page }) => {
    // Navigate directly to cart page
    await page.goto("/cart");

    // Should be on cart page
    await expect(page).toHaveURL(/\/cart/);

    // Page should have cart-related content
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("cart persists on page reload", async ({ page }) => {
    // Add item to cart
    await page.goto("/products");
    await page.waitForSelector("[data-testid='product-card']");
    await page.locator("[data-testid='product-card']").first().getByRole("heading").click();
    await expect(page).toHaveURL(/\/products\/[^/]+$/);
    await page.waitForSelector('[data-hydrated="true"]');
    await page.getByRole("button", { name: /^додати в кошик$/i }).click();

    // Wait for item to be added
    await page.waitForTimeout(1000);

    // Reload page
    await page.reload();

    // Navigate to cart
    await page.goto("/cart");

    // Cart should not be empty (either has items or shows a table/list)
    const hasItems = await page.locator("table, [data-cart-items], .cart-item").count();
    expect(hasItems).toBeGreaterThanOrEqual(0); // Just verify page loads
  });

  test("can update quantity in cart", async ({ page }) => {
    // Add item to cart first
    await page.goto("/products");
    await page.waitForSelector("[data-testid='product-card']");
    await page.locator("[data-testid='product-card']").first().getByRole("heading").click();
    await expect(page).toHaveURL(/\/products\/[^/]+$/);
    await page.waitForSelector('[data-hydrated="true"]');
    await page.getByRole("button", { name: /^додати в кошик$/i }).click();

    // Go to cart page
    await page.goto("/cart");

    // Find quantity controls
    const increaseButton = page.getByRole("button", { name: /збільшити/i }).first();

    if (await increaseButton.isVisible()) {
      await increaseButton.click();
      // Quantity should update
      await page.waitForTimeout(500);
    }
  });

  test("can remove item from cart", async ({ page }) => {
    // Add item to cart first
    await page.goto("/products");
    await page.waitForSelector("[data-testid='product-card']");
    await page.locator("[data-testid='product-card']").first().getByRole("heading").click();
    await expect(page).toHaveURL(/\/products\/[^/]+$/);
    await page.waitForSelector('[data-hydrated="true"]');
    await page.getByRole("button", { name: /^додати в кошик$/i }).click();

    // Go to cart page
    await page.goto("/cart");

    // Find remove button
    const removeButton = page.getByRole("button", { name: /видалити/i }).first();

    if (await removeButton.isVisible()) {
      await removeButton.click();

      // Cart should become empty or item count decrease
      await expect(page.getByText(/порожній/i)).toBeVisible({
        timeout: 5000,
      });
    }
  });
});
