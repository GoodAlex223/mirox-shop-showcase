import { readFileSync } from "node:fs";
import path from "node:path";
import { screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { renderWithIntl } from "../helpers/render-with-intl";
import uk from "../../messages/uk.json";

vi.mock("@/components/common/NewsletterSignup", () => ({
  NewsletterSignup: () => <div data-testid="newsletter" />,
}));

import { Footer } from "@/components/common/Footer";
import { DeveloperCredit } from "@/components/pages/DeveloperCredit";

describe("developer credit", () => {
  it("renders once in the footer, linking the developer site", () => {
    renderWithIntl(<Footer />);
    const link = screen.getByRole("link", { name: "GoodAlex223" });
    expect(link).toHaveAttribute("href", "https://goodalex223.github.io");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
  });

  it("renders no e-mail address in the footer", () => {
    const { container } = renderWithIntl(<Footer />);
    expect(container.textContent ?? "").not.toContain("@");
  });
});

/**
 * <DeveloperCredit/> itself — a plain (non-async) Server Component reading
 * pages.about.credit.{heading,body,linkLabel}, rendered inside async
 * StaticPage-based pages the same way SellerRequisites.tsx is (see
 * tests/unit/seller-requisites.test.tsx for the identical renderWithIntl
 * pattern — DeveloperCredit uses useTranslations, not getTranslations, so it
 * needs the client NextIntlClientProvider, not the server-mock helper).
 */
describe("<DeveloperCredit/>", () => {
  it("renders the catalog heading and links the developer site", () => {
    renderWithIntl(<DeveloperCredit />);
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(
      uk.pages.about.credit.heading
    );
    const link = screen.getByRole("link", { name: "GoodAlex223" });
    expect(link).toHaveAttribute("href", "https://goodalex223.github.io");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
  });
});

/**
 * The old plain-text section (Task 5) must be gone from pages.about.sections
 * now that Task 9 converts the mention into <DeveloperCredit/> — otherwise
 * the credit would render twice on /about (once as inert text, once as the
 * link). Asserted against the catalog directly, and against the about page
 * source to confirm it actually mounts the new component.
 */
describe("/about wiring", () => {
  it("drops the old plain-text credit section from pages.about.sections", () => {
    const headings = uk.pages.about.sections.map((s) => s.heading);
    expect(headings).not.toContain("Хто зробив цей сайт");
    expect(uk.pages.about.sections).toHaveLength(3);
  });

  it("has a pages.about.credit entry, outside sections, for <DeveloperCredit/>", () => {
    expect(uk.pages.about.credit).toEqual({
      heading: expect.any(String),
      body: expect.any(String),
      linkLabel: "GoodAlex223",
    });
  });

  it("mounts <DeveloperCredit/> as a child of <StaticPage/> on the about page", () => {
    const src = readFileSync(
      path.resolve(__dirname, "../../src/app/(shop)/about/page.tsx"),
      "utf8"
    );
    expect(src).toContain("<DeveloperCredit");
    expect(src).toContain("StaticPage");
  });
});
