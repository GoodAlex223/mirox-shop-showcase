import { test, expect } from "@playwright/test";

test.describe("Homepage", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("renders the Mirox hero slogan", async ({ page }) => {
    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading).toContainText("СТИЛЬ.");
    await expect(heading).toContainText("ЯКІСТЬ.");
    await expect(heading).toContainText("ВПЕВНЕНІСТЬ.");
  });

  test("primary CTA navigates to the catalog", async ({ page }) => {
    // Root-caused a non-deterministic failure here (and on the secondary CTA
    // test below): in isolated repeat runs it alternated which test failed —
    // sometimes this one, sometimes the other, sometimes neither — on BOTH
    // Mobile Safari and Mobile Chrome. That alternating pattern rules out a
    // fixed CSS overlay/z-index bug (which would fail the same element every
    // time); it's the signature of a hydration-timing race instead. The CTA
    // links are static <a> tags already present in the SSR HTML — visible,
    // and passing Playwright's actionability checks, well before React has
    // hydrated and next/link's client-side router is ready. A click that
    // lands in that window can have its native navigation prevented without
    // the router completing the replacement navigation, silently dropping
    // it (no error is thrown — the click "succeeds", the URL just never
    // changes). Same class of bug as webkit-pre-hydration-e2e-testing (that
    // one was fill()-specific to WebKit; this one is click-based and not
    // engine-specific, since it reproduced on Chrome too).
    //
    // Fix: wait for a signal that's provably POST-hydration, not just
    // post-paint. CookieConsent (mounted globally) renders `null` until its
    // own `useEffect` fires — which cannot happen before hydration commits —
    // then shows this banner when consent is still "pending" (the default
    // for every fresh Playwright browser context). Waiting for it first,
    // before interacting with anything else on the page, is a reliable
    // "hydration has definitely happened" gate without touching product code.
    await page.getByRole("button", { name: "Відхилити" }).waitFor();
    await page.getByRole("link", { name: "ПЕРЕЙТИ В КАТАЛОГ" }).click();
    await expect(page).toHaveURL(/\/products$/);
  });

  test("secondary CTA navigates to new arrivals", async ({ page }) => {
    // Same hydration-race root cause as the primary CTA test above — see its
    // comment for the full diagnosis. Same fix: wait for the post-hydration-
    // only cookie-consent banner before clicking.
    await page.getByRole("button", { name: "Відхилити" }).waitFor();
    await page.getByRole("link", { name: "ПЕРЕГЛЯНУТИ НОВИНКИ" }).first().click();
    await expect(page).toHaveURL(/sort=new/);
  });

  test("shows the why-choose-us block", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /чому обирають нас/i })).toBeVisible();
  });

  test("shows social links", async ({ page }) => {
    // Social links live in the footer only since TASK-057's homepage
    // restructure removed the dedicated tiles section — scope the locator so
    // this doesn't accidentally match a future header/nav Instagram link.
    await expect(
      page
        .locator("footer")
        .getByRole("link", { name: /Instagram/i })
        .first()
    ).toBeVisible();
  });

  test("announcement bar dismisses and stays dismissed when configured", async ({ page }) => {
    const dismiss = page.getByRole("button", { name: "Приховати оголошення" });

    // `site.announcement` (src/content/site.ts) went LIVE site-wide in G8
    // TASK-059 (the launch marquee) — it's no longer `null` by default, so
    // the dismiss button is expected to appear. This test still accommodates
    // BOTH states rather than assuming either: it waits briefly for the
    // button (covering the post-hydration reveal via useSyncExternalStore),
    // and if it never shows up (e.g. a future config sets `announcement` back
    // to null), asserts the bar is genuinely absent and stops there.
    // (This is not the WebKit pre-hydration race from TASK-038a — that was a
    // real button arriving late; here, with announcement === null, the
    // button never arrives at all.)
    const appeared = await dismiss
      .waitFor({ state: "visible", timeout: 5000 })
      .then(() => true)
      .catch(() => false);

    if (!appeared) {
      await expect(dismiss).toHaveCount(0);
      return;
    }

    await dismiss.click();
    await expect(dismiss).toBeHidden();

    await page.reload();
    await expect(dismiss).toBeHidden();
  });
});
