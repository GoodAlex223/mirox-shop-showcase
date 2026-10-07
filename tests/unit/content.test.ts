import { describe, it, expect } from "vitest";
import { site } from "@/content/site";
import { home } from "@/content/home";

describe("site content", () => {
  it("exposes the Mirox brand name", () => {
    expect(site.name).toBe("Mirox Shop");
  });

  it("declares exactly the three briefed social platforms", () => {
    expect(site.socials.map((s) => s.platform)).toEqual(["instagram", "tiktok", "telegram"]);
  });

  it("defaults every follower count to null so no counter is fabricated", () => {
    expect(site.socials.every((s) => s.followers === null)).toBe(true);
  });

  it("carries the store's own claim figures", () => {
    expect(site.claims.olxSales).toBe("300+");
    expect(site.claims.instagramOrders).toBe("100+");
  });

  it("points the launch announcement at the feedback form as a marquee", () => {
    expect(site.announcement?.href).toBe("/feedback");
    expect(site.announcement?.marquee).toBe(true);
    expect(site.announcement?.id).toBeTruthy();
    // text/linkLabel moved to the catalog (TASK-039 G9) — covered by
    // i18n-catalogs.test.ts's apostrophe-render test instead.
  });
});

describe("home content", () => {
  // headline pair moved to i18n-catalogs.test.ts (string content, catalog-sourced).

  it("has no eyebrow — removed 2026-07-28 for the multi-brand store, kept config-gated", () => {
    expect(home.hero.eyebrow).toBeNull();
  });

  it("uses the homepage-section CTA labels, not the mockup-prompt ones", () => {
    expect(home.hero.primaryCta.href).toBe("/products");
    expect(home.hero.secondaryCta.href).toBe("/products?sort=new");
  });

  it("configures the hero image at the handoff's path", () => {
    expect(home.hero.image).not.toBeNull();
    expect(home.hero.image?.src).toBe("/images/hero-model-2.png");
  });

  it("provides exactly four benefit cards", () => {
    expect(home.benefits).toHaveLength(4);
    expect(site.footerBenefits).toHaveLength(4);
  });

  // Retraction regex + whyChooseUs count/intro moved to i18n-catalogs.test.ts
  // (string content, catalog-sourced — home.whyChooseUs no longer exists on
  // this trimmed module, and home.benefits/site.footerBenefits no longer
  // carry title/description to scan).

  it("exposes only the new-arrivals rail (featured/bestsellers removed)", () => {
    expect(Object.keys(home.rails)).toEqual(["newArrivals"]);
  });

  it("points the new-arrivals rail at the full catalog", () => {
    expect(home.rails.newArrivals.viewAllHref).toBe("/products");
    // viewAllLabel moved to the catalog as home.rails.newArrivals.viewAllLabel.
  });
});

// "auth content" describe block removed (TASK-039 G9 Task 5) — src/content/auth.ts
// deleted; the uppercase-CTA assertion moved to i18n-catalogs.test.ts (reads
// messages/uk.json directly).

// "account content" describe block removed (PR #37 review round 2) —
// src/content/account.ts deleted: its two label maps had no production
// consumers (admin now sources labels from the catalog since G13, reusing
// these same account.* keys; the account pages read the catalog too). The
// Prisma-enum label coverage lives in
// i18n-catalogs.test.ts's drift net against messages/uk.json. The
// customer-copy `account.orders.card.more` plural and
// `account.orderDetail.payment.methodLabel` ternary moved out back in
// Task 5 — ICU pattern via i18n-catalogs.test.ts's Probe, and the
// order-detail component's methodCod/methodCard strings respectively.

// "newsletter content" / "system content" / "feedback content" describe
// blocks removed (TASK-039 G9 Task 5) — src/content/{newsletter,system,
// feedback}.ts deleted. byCode coverage moved to i18n-catalogs.test.ts's
// "byCode coverage" block (1:1 per the plan); the unsubscribe-prompt
// interpolation and cookie-banner-button-pair assertions moved to
// i18n-catalogs.test.ts's "message catalogs" block.

// "site header content" describe block removed (TASK-039 G9) — site.header
// no longer exists on the trimmed content module; equivalent coverage lives
// in i18n-catalogs.test.ts's guillemets/query-interpolation test.
