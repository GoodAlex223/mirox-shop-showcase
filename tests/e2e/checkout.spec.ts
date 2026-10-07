import { test, expect, type Page } from "@playwright/test";
import { API_CITIES, API_BRANCHES, RAW_BRANCH_1 } from "../fixtures/nova-poshta";

// G25: CI never depends on the live Nova Poshta API — both directory routes are
// answered from the 2026-10-04 fixtures. A regex, not a glob: `?` in a Playwright
// glob is not reliably literal across versions.
async function stubNovaPoshta(page: Page) {
  await page.route(/\/api\/shipping\/np\/cities\b/, (route) => route.fulfill({ json: API_CITIES }));
  await page.route(/\/api\/shipping\/np\/warehouses\b/, (route) =>
    route.fulfill({ json: API_BRANCHES })
  );
}

async function addFirstProductToCart(page: Page) {
  // Same pattern as cart.spec.ts: click the card heading, not the card center
  // (quick-view overlay).
  await page.goto("/products");
  await page.waitForSelector("[data-testid='product-card']");
  await Promise.all([
    page.waitForURL(/\/products\/[^/]+$/),
    page.locator("[data-testid='product-card']").first().getByRole("heading").click(),
  ]);
  await page.waitForSelector('[data-hydrated="true"]');
  await page.getByRole("button", { name: /^додати в кошик$/i }).click();
  await expect(page.getByRole("button", { name: /додано в кошик/i })).toBeVisible({
    timeout: 5000,
  });
}

async function fillContactsStep(page: Page, email: string) {
  // Fields only exist post-mount, so fill is safe (WebKit pre-hydration lesson).
  await page.getByLabel(/^ім'я$/i).fill("Тест Тестовий");
  await page.getByLabel(/^телефон$/i).fill("+380501234567");
  await page.getByLabel(/^email$/i).fill(email);
  await page.getByRole("button", { name: /далі — доставка/i }).click();
}

/** The branch the stubbed directory returns — not in any catalog string, so its absence is a real check. */
const POINT = RAW_BRANCH_1.Description;

// Guest COD checkout flow (G2). The checkout page renders a loader until the
// client mounts (mounted gate), so form fields existing at all implies
// hydration — no pre-hydration fill risk (WebKit lesson: never fill() before
// a hydration-only render signal).
test.describe("Checkout (guest COD)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
  });

  test("guest reaches checkout without a login redirect", async ({ page }) => {
    await page.goto("/checkout");
    await expect(page).toHaveURL(/\/checkout/);
    // Empty cart → Ukrainian empty state (still proves no auth redirect)
    await expect(page.getByText(/кошик порожній/i)).toBeVisible();
  });

  test("guest can place a COD order end-to-end", async ({ page }) => {
    await addFirstProductToCart(page);
    await stubNovaPoshta(page);
    await page.goto("/checkout");
    await fillContactsStep(page, "guest-e2e@example.com");

    // Step 2 — Доставка (np-office pre-selected): city, then branch, both
    // chosen from the (stubbed) Nova Poshta directory.
    await expect(page.getByText("Нова Пошта — відділення")).toBeVisible();
    await page.getByLabel(/^місто$/i).fill("Київ");
    await page.getByRole("option", { name: /^Київ/ }).click();
    await page.getByLabel(/^відділення$/i).click();
    await page.getByRole("option", { name: /Відділення №1:/ }).click();
    await expect(page.getByLabel(/^відділення$/i)).toHaveValue(POINT);
    await page.getByRole("button", { name: /далі — оплата/i }).click();

    // Step 3 — Оплата (COD, no payment processing)
    await expect(page.getByText(/працюємо без передоплати/i)).toBeVisible();
    await page.getByRole("button", { name: /підтвердити замовлення/i }).click();

    // Confirmation — a real PENDING order was created
    await page.waitForURL(/\/checkout\/confirmation\?order=/, { timeout: 15000 });
    await expect(page.getByText(/замовлення прийнято/i)).toBeVisible();
    // Deviation from the task-8 brief's verbatim /оплата при отриманні/i: the
    // site-wide Footer BenefitStrip (src/content/site.ts footerBenefits) also
    // renders the exact title "Оплата при отриманні" on every page, so that
    // regex is a strict-mode violation (2 matches) here — confirmed failing
    // identically on all 5 local browser projects, not a browser flake.
    // Matching the confirmation page's own longer copy («…у відділенні»,
    // checkout.confirmation.paymentCod) is unique and also asserts the
    // specific order.paymentMethod === "cod" branch, not just any COD text
    // on the page.
    await expect(page.getByText(/оплата при отриманні у відділенні/i)).toBeVisible();
    // Positive control for the cold-body probe below: the authorized page
    // renders the e-mail (twice), so its absence from the cold body is a real
    // rejection check, not a marker the page never prints.
    await expect(page.getByText("guest-e2e@example.com").first()).toBeVisible();

    // --- G18: the grant cookie carried the confirmation; a cold visit must not.
    const confirmationUrl = page.url();
    const orderNumber = new URL(confirmationUrl).searchParams.get("order")!;
    expect(orderNumber).toMatch(/^ORD-[A-Z0-9]+-[A-Z0-9]{4}$/);

    await page.context().clearCookies();
    await page.goto(confirmationUrl);
    await page.waitForURL(/\/track\?order=ORD-/, { timeout: 15000 });

    // The rejection itself must carry none of the order's values: fetch the
    // bearer URL cold (page.request shares the cleared cookie jar) and check
    // the response body, not the page we were redirected to.
    const cold = await page.request.get(confirmationUrl);
    const coldBody = await cold.text();
    expect(coldBody).not.toContain("Тест Тестовий");
    // The branch name is now a real check: it comes from the NP directory, not
    // from any catalog placeholder baked into the page payload (G25 — before,
    // «Відділення №12» was also the input placeholder, so this assertion was
    // impossible).
    expect(coldBody).not.toContain(POINT);
    // The phone number would be vacuous: the confirmation page never renders it.
    // The e-mail is rendered twice (the "sent to" line and the e-mail card).
    expect(coldBody).not.toContain("guest-e2e@example.com");

    // Verify the rejection, not just the redirect: no order data reached the page.
    await expect(page.getByText(/адреса доставки/i)).toHaveCount(0);
    await expect(page.getByText("Тест Тестовий")).toHaveCount(0);
    await expect(page.getByText(POINT)).toHaveCount(0);
    await expect(page.getByLabel(/^номер замовлення$/i)).toHaveValue(orderNumber);

    // WebKit hydration race (project lesson): fields render in the SSR HTML,
    // so a fill() before React hydrates silently drops on WebKit — wait for
    // the mount signal before the first fill on this page.
    await page.waitForSelector('form[data-hydrated="true"]');

    // Wrong e-mail → uniform not-found copy, still on the form.
    await page.getByLabel(/^email$/i).fill("someone-else@example.com");
    await page.getByRole("button", { name: /^перевірити$/i }).click();
    await expect(page.getByText(/з таким номером та email не знайдено/i)).toBeVisible();
    await expect(page).toHaveURL(/\/track\?order=/);

    // Right e-mail → the status page, PENDING in Ukrainian, the number on screen.
    await page.getByLabel(/^email$/i).fill("guest-e2e@example.com");
    await page.getByRole("button", { name: /^перевірити$/i }).click();
    await page.waitForURL(new RegExp(`/track/${orderNumber}$`), { timeout: 15000 });
    await expect(page.getByRole("heading", { name: orderNumber })).toBeVisible();
    await expect(page.getByText("Очікує підтвердження")).toBeVisible();
    await expect(page.getByText(/адреса доставки/i)).toBeVisible();
    await expect(page.getByText("Тест Тестовий")).toBeVisible();
    await expect(page.getByText(POINT)).toBeVisible();
  });

  test("delivery falls back to free text when Nova Poshta is unavailable", async ({ page }) => {
    await page.route(/\/api\/shipping\/np\//, (route) =>
      route.fulfill({
        status: 502,
        json: { error: "Nova Poshta is unavailable", code: "NP_UNAVAILABLE" },
      })
    );
    await addFirstProductToCart(page);
    await page.goto("/checkout");
    await fillContactsStep(page, "fallback-e2e@example.com");

    // The first search fails → manual mode with the notice.
    await page.getByLabel(/^місто$/i).fill("Київ");
    await expect(page.getByText(/не вдалося завантажити довідник/i)).toBeVisible();

    // The free-text fields replaced the pickers; the order still goes through.
    await page.getByLabel(/^місто$/i).fill("Київ");
    await page.getByLabel(/відділення \/ адреса/i).fill("Відділення №12");
    await page.getByRole("button", { name: /далі — оплата/i }).click();
    await expect(page.getByText(/працюємо без передоплати/i)).toBeVisible();
    await page.getByRole("button", { name: /підтвердити замовлення/i }).click();
    await page.waitForURL(/\/checkout\/confirmation\?order=/, { timeout: 15000 });
    await expect(page.getByText(/замовлення прийнято/i)).toBeVisible();
  });

  test("a Latin or refused city query is «nothing found», not the manual-entry fallback", async ({
    page,
  }) => {
    await addFirstProductToCart(page);
    await page.goto("/checkout");
    await fillContactsStep(page, "latin-city-e2e@example.com");

    // Layer 1 — the REAL route, no stub: a query with no Cyrillic letter and no digit never
    // reaches Nova Poshta, which would answer it with success:false (final review I1).
    await page.getByLabel(/^місто$/i).fill("Kyiv");
    // Generous: the first hit compiles the route on a cold dev server.
    await expect(page.getByText("Нічого не знайдено")).toBeVisible({ timeout: 30000 });
    await expect(page.getByText(/не вдалося завантажити довідник/i)).toHaveCount(0);
    await expect(page.getByLabel(/^місто$/i)).toHaveAttribute("role", "combobox");

    // Layer 2 — a 400 from the route (a refused query) settles as empty too, never as an outage.
    await page.route(/\/api\/shipping\/np\/cities\b/, (route) =>
      route.fulfill({
        status: 400,
        json: { error: "Invalid city search", code: "VALIDATION_ERROR" },
      })
    );
    await page.getByLabel(/^місто$/i).fill("Київ");
    await expect(page.getByText("Нічого не знайдено")).toBeVisible();
    await expect(page.getByText(/не вдалося завантажити довідник/i)).toHaveCount(0);
    await expect(page.getByLabel(/^місто$/i)).toHaveAttribute("role", "combobox");
  });

  test("fallback after a choice drops the NP refs from the order", async ({ page }) => {
    await addFirstProductToCart(page);
    await stubNovaPoshta(page);
    await page.goto("/checkout");
    await fillContactsStep(page, "fallback-after-choice-e2e@example.com");

    // Both refs are held: a city and a branch were chosen from the (stubbed) directory.
    await page.getByLabel(/^місто$/i).fill("Київ");
    await page.getByRole("option", { name: /^Київ/ }).click();
    await page.getByLabel(/^відділення$/i).click();
    await page.getByRole("option", { name: /Відділення №1:/ }).click();
    await expect(page.getByLabel(/^відділення$/i)).toHaveValue(POINT);

    // The directory now fails; refocusing the point picker reloads its list and trips the fallback.
    await page.unroute(/\/api\/shipping\/np\/warehouses\b/);
    await page.route(/\/api\/shipping\/np\/warehouses\b/, (route) =>
      route.fulfill({
        status: 502,
        json: { error: "Nova Poshta is unavailable", code: "NP_UNAVAILABLE" },
      })
    );
    await page.getByRole("heading", { name: /^доставка$/i }).click(); // blur the picker
    await page.getByLabel(/^відділення$/i).click();
    await expect(page.getByText(/не вдалося завантажити довідник/i)).toBeVisible();

    // Free-text fields replaced the pickers; the order goes through without NP refs.
    await page.getByLabel(/^місто$/i).fill("Київ");
    await page.getByLabel(/відділення \/ адреса/i).fill("Відділення №12");
    await page.getByRole("button", { name: /далі — оплата/i }).click();
    await expect(page.getByText(/працюємо без передоплати/i)).toBeVisible();

    const orderRequest = page.waitForRequest(
      (request) =>
        request.url().includes("/api/checkout/create-order") && request.method() === "POST"
    );
    await page.getByRole("button", { name: /підтвердити замовлення/i }).click();
    const { shippingAddress } = (await orderRequest).postDataJSON();

    expect(shippingAddress).not.toHaveProperty("npCityRef");
    expect(shippingAddress).not.toHaveProperty("npWarehouseRef");
    expect(shippingAddress.state ?? "").toBe("");
    expect(shippingAddress.line1).toBe("Відділення №12");
    await page.waitForURL(/\/checkout\/confirmation\?order=/, { timeout: 15000 });
    await expect(page.getByText(/замовлення прийнято/i)).toBeVisible();
  });

  test("picker mode rejects an empty step 2, and the error clears once both are chosen", async ({
    page,
  }) => {
    await addFirstProductToCart(page);
    await stubNovaPoshta(page);
    await page.goto("/checkout");
    await fillContactsStep(page, "picker-validation-e2e@example.com");

    await page.getByRole("button", { name: /далі — оплата/i }).click();
    await expect(page.getByText("Оберіть місто зі списку")).toBeVisible();
    await expect(page.getByText("Оберіть відділення зі списку")).toBeVisible();

    await page.getByLabel(/^місто$/i).fill("Київ");
    await page.getByRole("option", { name: /^Київ/ }).click();
    await page.getByLabel(/^відділення$/i).click();
    await page.getByRole("option", { name: /Відділення №1:/ }).click();
    // Both picker errors are gone once both choices are made — before Continue.
    await expect(page.getByText("Оберіть місто зі списку")).toHaveCount(0);
    await expect(page.getByText("Оберіть відділення зі списку")).toHaveCount(0);
    await page.getByRole("button", { name: /далі — оплата/i }).click();
    await expect(page.getByText(/працюємо без передоплати/i)).toBeVisible();
  });

  test("step 1 shows Ukrainian validation errors on empty submit", async ({ page }) => {
    // Need a non-empty cart to see the form at all
    await addFirstProductToCart(page);

    await page.goto("/checkout");
    await page.getByRole("button", { name: /далі — доставка/i }).click();
    await expect(page.getByText("Вкажіть ім'я")).toBeVisible();
    await expect(page.getByText("Вкажіть номер телефону")).toBeVisible();
  });
});
