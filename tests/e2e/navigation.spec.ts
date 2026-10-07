import { test, expect } from "@playwright/test";

test.describe("Navigation", () => {
  test("homepage loads successfully", async ({ page, isMobile }) => {
    await page.goto("/");

    // Check page title. Deliberately matches only the brand-name segment
    // ("Mirox"), never BRAND_META_SUFFIX's text: that suffix is now Ukrainian
    // ("Сучасний одяг", src/content/brand.ts) and locale work (TASK-039) may
    // change it again, while siteConfig.name (src/lib/seo.ts) reads
    // NEXT_PUBLIC_STORE_NAME and falls back to BRAND_NAME — CI leaves that
    // var unset, so the title is "Mirox Shop — Сучасний одяг"; a local .env
    // may override the name to something else entirely. /Mirox/ is the one
    // substring stable across both environments and future locale changes —
    // do not "tighten" this to the suffix text.
    // Kept as a literal rather than importing BRAND_NAME: this is the only
    // E2E spec that would import app source, and brand.ts's zero-import rule
    // is a comment, not an enforced invariant — if it ever gained an import
    // this would fail at transform time instead of as a readable diff.
    await expect(page).toHaveTitle(/Mirox/);

    // Check main navigation elements (only on desktop - mobile has hamburger
    // menu). Header.tsx's `navigation` array (Task 6, per this branch's
    // design handoff) is Ukrainian and matches Mirox Home.dc.html:28-34
    // exactly. G12 (user decision 2026-08-18) added a fourth desktop entry
    // alongside it — a plain «Категорії» link to the index, matching the
    // mobile menu's own entry — because the G4 visual gate found the desktop
    // header had no way to reach categories at all. It is a standalone
    // <Link>, not a `navigation` array member (that array also feeds the
    // mobile menu, which already renders its own «Категорії» link).
    // Scoped to the <header> landmark: Footer.tsx has its own "Каталог" /
    // "Новинки" / categories links (to the same hrefs), so an unscoped
    // getByRole match resolves to 2 elements and throws a strict-mode
    // violation.
    if (!isMobile) {
      const header = page.getByRole("banner");
      await expect(header.getByRole("link", { name: "Каталог", exact: true })).toHaveAttribute(
        "href",
        "/products"
      );
      await expect(header.getByRole("link", { name: "Новинки", exact: true })).toHaveAttribute(
        "href",
        "/products?sort=new"
      );
      await expect(header.getByRole("link", { name: "Бестселери", exact: true })).toHaveAttribute(
        "href",
        "/products?sort=popular"
      );
      await expect(header.getByRole("link", { name: "Категорії", exact: true })).toHaveAttribute(
        "href",
        "/categories"
      );
    }

    // Check hero section
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("can navigate to products page", async ({ page, isMobile }) => {
    await page.goto("/");

    // "Каталог" ("Catalog") is the nav item that links to the bare /products
    // route; "Новинки"/"Бестселери" also point at /products but with query
    // params (new-arrivals / featured sort), so this must match the exact
    // label rather than a generic /products/i or /catalog/i regex. On mobile
    // viewports the desktop <nav> is `md:hidden` (genuinely not visible, not
    // just off-screen) — real mobile users reach it via the hamburger menu
    // instead, so open that first rather than clicking an invisible element.
    if (isMobile) {
      await page.getByRole("button", { name: /меню/i }).click();
      await page.getByRole("dialog").getByRole("link", { name: "Каталог", exact: true }).click();
    } else {
      // Scoped to <header>: Footer.tsx has its own "Каталог" link too.
      await page.getByRole("banner").getByRole("link", { name: "Каталог", exact: true }).click();
    }

    // Anchored at the end: distinguishes the bare /products landing from the
    // query-string variants the other two nav items would also satisfy.
    await expect(page).toHaveURL(/\/products$/);
    // TASK-036 renamed the catalog H1 from "Products" to «Каталог». This
    // assertion was stale after the rename but masked locally: against `next
    // dev` the test dies earlier at the URL assertion (pre-existing dev-server
    // race, fails on main too), so only CI's production build ever reached it.
    await expect(page.getByRole("heading", { level: 1, name: "Каталог" })).toBeVisible();
  });

  test("can navigate to categories page via mobile menu", async ({ page }) => {
    // Since G12 the desktop header has its own «Категорії» entry (asserted
    // above), but this test forces a 375px viewport, where that <nav> is
    // md:hidden — so the mobile Sheet menu is still the only reachable nav
    // path to /categories here (Header.tsx's own "Категорії" link, from
    // header.categories). Scoped to the sheet's role="dialog" so this
    // doesn't also match Footer.tsx's own categories links.
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/");

    await page.getByRole("button", { name: /меню/i }).click();
    await page.getByRole("dialog").getByRole("link", { name: "Категорії", exact: true }).click();

    await expect(page).toHaveURL(/\/categories/);
    // Task 11 renamed the /categories H1 to «Категорії» (src/app/(shop)/categories/page.tsx).
    await expect(page.getByRole("heading", { level: 1, name: "Категорії" })).toBeVisible();
  });

  test("cart icon is visible in header", async ({ page }) => {
    await page.goto("/");

    // Cart button/icon should be visible
    const cartButton = page.getByRole("button", { name: /кошик|cart/i }).first();
    await expect(cartButton).toBeVisible();
  });

  test("mobile menu works on small screens", async ({ page }) => {
    // Set viewport to mobile size
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/");

    // Look for mobile menu button
    const menuButton = page.getByRole("button", { name: /меню/i });

    if (await menuButton.isVisible()) {
      await menuButton.click();

      // Navigation links should become visible: the Ukrainian nav items
      // (Каталог/Новинки/Бестселери) plus the mobile-only Категорії entry.
      // Scoped to the sheet's role="dialog": Footer.tsx (always in the DOM,
      // regardless of scroll position) has its own Каталог/Новинки links.
      const sheet = page.getByRole("dialog");
      await expect(sheet.getByRole("link", { name: "Каталог", exact: true })).toBeVisible();
      await expect(sheet.getByRole("link", { name: "Новинки", exact: true })).toBeVisible();
      await expect(sheet.getByRole("link", { name: "Бестселери", exact: true })).toBeVisible();
      await expect(sheet.getByRole("link", { name: "Категорії", exact: true })).toBeVisible();
    }
  });

  test("footer and header nav links all resolve to a real page (G23 link sweep)", async ({
    page,
  }) => {
    // Explicit timeout. This test does up to 14 sequential page.goto() +
    // visible-h1 checks after the two count assertions, and measured at
    // 21-26s warm / 57.9s cold (first `next dev` compile) locally — against
    // CI's 30s default per-test timeout (playwright.config.ts), that's
    // near-zero margin even granting CI runs a pre-built app with no
    // compile-on-first-visit. 120s gives real headroom over the COLD
    // measurement, not just the warm one, without masking a genuine hang:
    // each page.goto() is still bounded by its own navigationTimeout (15s
    // CI / 45s local) and each h1 check by the 5s default expect timeout
    // (no override in playwright.config.ts), so one stuck page fails on its
    // own well before this budget is exhausted rather than eating it
    // silently.
    test.setTimeout(120_000);

    // Own viewport, not the project default. Header.tsx's desktop <nav> is
    // `hidden` below the md breakpoint and shown via `md:flex` at md and up
    // (Header.tsx:314) — pure Tailwind responsive display, no JS/matchMedia
    // gating. A `display:none` element stays in the DOM, and the plain CSS
    // `.locator()`/`.evaluateAll()` below still matches it (unlike
    // `getByRole`, which respects the accessibility tree and would not) —
    // so headerHrefs.length below would be 5 at ANY viewport; this pin is
    // not what makes that count correct. It's kept so the sweep exercises
    // the actual surface a desktop visitor sees rather than leaning on that
    // DOM-vs-CSS detail, and so the test is deterministic across whichever
    // Playwright project runs the file (CI: chromium+webkit, both desktop;
    // local: 5 projects, 2 of them mobile devices) — same reasoning as
    // mobile-overflow.spec.ts's own explicit viewport.
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");

    const getInternalHrefs = (locator: ReturnType<typeof page.locator>) =>
      locator.evaluateAll((els) =>
        Array.from(
          new Set(
            (els as HTMLAnchorElement[])
              .map((el) => el.getAttribute("href"))
              .filter((href): href is string => !!href)
          )
        )
      );

    const footerHrefs = await getInternalHrefs(page.locator('footer a[href^="/"]'));

    // Footer.tsx's SHOP_LINK_GROUPS: 5 «Магазин» links + 7 «Інформація»
    // links = 12. Asserted BEFORE the loop below — a selector that silently
    // matches zero elements would otherwise let this whole sweep pass having
    // visited no pages at all, the exact vacuity class this plan's other
    // guards (mobile-overflow.spec.ts, nav-link-integrity.test.ts) already
    // exist to catch.
    expect(footerHrefs.length).toBe(12);

    // Header.tsx's desktop <nav> (`hidden md:flex`, visible at this 1280px
    // viewport): the 4-item `navigation` array (Каталог /products, Новинки
    // /products?sort=new, Бестселери /products?sort=popular, Контакти
    // /contact) plus the standalone «Категорії» /categories link (G12) = 5.
    // The isAdmin-gated /admin link is excluded — this test never signs in.
    // The mobile menu's <nav> (same component tree, inside <SheetContent>)
    // does NOT double-count it: shadcn's Sheet wraps it in Radix's
    // SheetPortal, which (a) renders to document.body by default, outside
    // the <header> DOM subtree entirely, and (b) wraps it in Presence with
    // `present={context.open}` and no forceMount, so while mobileMenuOpen is
    // false (its default, never toggled in this test) it isn't in the DOM at
    // all — confirmed against the installed @radix-ui/react-dialog@1.1.15 /
    // @radix-ui/react-portal source, not assumed.
    const headerHrefs = await getInternalHrefs(
      page.getByRole("banner").locator('nav a[href^="/"]')
    );
    expect(headerHrefs.length).toBe(5);

    const allHrefs = Array.from(new Set([...footerHrefs, ...headerHrefs]));

    for (const href of allHrefs) {
      const response = await page.goto(href);
      expect(response?.status(), `${href} did not respond with 200`).toBe(200);
      await expect(
        page.getByRole("heading", { level: 1 }).first(),
        `${href} has no visible h1`
      ).toBeVisible();
    }
  });
});
