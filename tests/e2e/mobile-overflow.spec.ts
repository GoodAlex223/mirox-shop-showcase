import { test, expect } from "@playwright/test";

/**
 * The page must never scroll sideways on a phone.
 *
 * Found by the G20 visual gate: at 390px the homepage document measured 396px
 * wide. The cause was the footer's copyright-row nav — five Ukrainian link
 * labels in a `flex gap-6` with no wrap, 380px of content in 358px of
 * container — so it affected EVERY page that renders the footer, not one
 * layout.
 *
 * Two deliberate choices about where this lives:
 *
 * 1. **It sets its own viewport** rather than relying on a mobile project.
 *    CI runs `--project=chromium --project=webkit` only (see ci.yml), both
 *    desktop devices — a spec that depended on `Mobile Chrome`/`Mobile Safari`
 *    would pass locally and never run on the branch that matters.
 * 2. **It is an E2E test, not a unit test.** Nothing about this is visible to
 *    jsdom: it needs real layout, real fonts and a real viewport. A unit test
 *    asserting `flex-wrap` is in the className would only restate the fix.
 */

/** iPhone 12 / Pixel-class width — the narrowest viewport the storefront targets. */
const MOBILE = { width: 390, height: 844 };

/**
 * Pages chosen to separate "the footer" from "one page's layout": the
 * homepage has the rail and the hero, /cart and /track are near-empty, and
 * /feedback is a form. If only one regresses it is that page; if all of them
 * do it is shared chrome.
 *
 * The seven /contact, /about, /shipping, /returns, /faq, /privacy, /terms
 * routes were added in G23 (TASK-055 Task 10): the footer gained a new
 * banded link-groups section in Task 8 (SHOP_LINK_GROUPS, Footer.tsx) to
 * carry them, which is the same "shared chrome, twelve links, narrow
 * viewport" bug class this spec exists to catch — the routes themselves are
 * plain text pages, but the grid band linking to them is new shared markup
 * on every page, so it gets the same treatment as the earlier footer fix.
 */
const PAGES = [
  "/",
  "/products",
  "/cart",
  "/track",
  "/feedback",
  "/contact",
  "/about",
  "/shipping",
  "/returns",
  "/faq",
  "/privacy",
  "/terms",
];

for (const path of PAGES) {
  test(`${path} does not scroll horizontally at ${MOBILE.width}px`, async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await page.goto(path);

    // The footer carries the element that caused the original bug, so if it
    // hasn't rendered this test would pass without having measured anything.
    await expect(page.locator("footer")).toBeVisible();

    const result = await page.evaluate(() => {
      const doc = document.documentElement;
      const overflowing: string[] = [];

      // Report WHAT overflows, not just that something does — the original
      // investigation cost a separate scripted pass to answer that. Elements
      // inside a clipping or scrolling ancestor are skipped: a horizontal
      // scroller's own content legitimately extends past the viewport and
      // never widens the document.
      for (const el of Array.from(doc.querySelectorAll<HTMLElement>("*"))) {
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.right <= doc.clientWidth + 0.5) continue;

        let parent = el.parentElement;
        let clipped = false;
        while (parent) {
          const overflowX = getComputedStyle(parent).overflowX;
          if (["hidden", "auto", "scroll", "clip"].includes(overflowX)) {
            clipped = true;
            break;
          }
          parent = parent.parentElement;
        }
        if (clipped) continue;

        overflowing.push(
          `<${el.tagName.toLowerCase()} class="${el.className}"> right=${Math.round(rect.right)}`
        );
      }

      return {
        scrollWidth: doc.scrollWidth,
        clientWidth: doc.clientWidth,
        overflowing: overflowing.slice(0, 5),
      };
    });

    expect(
      result.scrollWidth,
      `${path} overflows by ${result.scrollWidth - result.clientWidth}px. Unclipped offenders:\n` +
        (result.overflowing.join("\n") || "(none found — check for a wide clipped ancestor)")
    ).toBeLessThanOrEqual(result.clientWidth);
  });
}
