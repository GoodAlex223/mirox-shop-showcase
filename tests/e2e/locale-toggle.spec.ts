import { test, expect } from "@playwright/test";

test.describe("Locale toggle", () => {
  test("switches html lang to ru, persists across reload, and switches back", async ({
    page,
    isMobile,
  }) => {
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("lang", "uk");

    // Header renders TWO `locale-switcher-*` instances at all times the mobile
    // sheet is open: the always-present desktop one (`hidden md:flex`, CSS-hidden
    // below md) and the mobile one portaled inside the Radix Sheet dialog. A
    // page-wide `.first()` resolves to the hidden desktop node (it's earlier in
    // document order), so every locator below is scoped to whichever instance is
    // actually reachable/visible: the open dialog on mobile, the header on
    // desktop (the sheet's dialog doesn't exist in the DOM until opened, so
    // scoping to <header> is unambiguous there regardless of viewport).
    if (isMobile) {
      // Toggle lives in the mobile menu sheet.
      await page.getByRole("button", { name: "Відкрити меню" }).click();
      await page.getByRole("dialog").getByTestId("locale-switcher-ru").click();
    } else {
      await page.locator("header").getByTestId("locale-switcher-ru").click();
    }

    // Authoritative assertion: cookie-driven re-render lands lang=ru
    await expect(page.locator("html")).toHaveAttribute("lang", "ru", { timeout: 15000 });

    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("lang", "ru");

    if (isMobile) {
      // Empirically verified: the setLocale server action's transition keeps the
      // sheet open (Header's `mobileMenuOpen` client state survives the refresh),
      // but `page.reload()` is a hard navigation that resets all client state, so
      // the sheet is closed again here. Re-open it before touching the switcher
      // so every assertion below targets the visible instance, not a closed/
      // absent one.
      await page
        .getByRole("button", { name: "Открыть меню" })
        .or(page.getByRole("button", { name: "Відкрити меню" }))
        .first()
        .click();
      // The switcher itself re-labels in RU (common.localeSwitcher)
      await expect(page.getByRole("dialog").getByTestId("locale-switcher")).toHaveAttribute(
        "aria-label",
        "Язык"
      );
      await page.getByRole("dialog").getByTestId("locale-switcher-uk").click();
    } else {
      // The switcher itself re-labels in RU (common.localeSwitcher)
      await expect(page.locator("header").getByTestId("locale-switcher")).toHaveAttribute(
        "aria-label",
        "Язык"
      );
      await page.locator("header").getByTestId("locale-switcher-uk").click();
    }

    await expect(page.locator("html")).toHaveAttribute("lang", "uk", { timeout: 15000 });
  });
});
