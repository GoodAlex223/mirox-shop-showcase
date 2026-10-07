import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

const mockSocials = [
  { platform: "instagram", label: "Instagram", href: "https://instagram.com/x", followers: null },
  { platform: "tiktok", label: "TikTok", href: "https://tiktok.com/@x", followers: 12500 },
  { platform: "telegram", label: "Telegram", href: "https://t.me/x", followers: 0 },
];
vi.mock("@/content/site", () => ({
  site: {
    get socials() {
      return mockSocials;
    },
  },
}));

import { SocialLinks } from "@/components/common/SocialLinks";

describe("SocialLinks", () => {
  it("renders a link per configured platform", () => {
    render(<SocialLinks />);
    expect(screen.getByRole("link", { name: /Instagram/ })).toHaveAttribute(
      "href",
      "https://instagram.com/x"
    );
    expect(screen.getByRole("link", { name: /TikTok/ })).toBeInTheDocument();
  });

  it("shows a counter only for platforms with a real follower count", () => {
    render(<SocialLinks />);
    // TikTok has 12500 and renders formatted; Instagram has null and renders none;
    // Telegram has 0 (a real value) and renders as "0".
    expect(screen.getByText("12.5K")).toBeInTheDocument();

    // The guard under test is `social.followers !== null && <span>...</span>`.
    // If it ever regresses to a truthy check (`social.followers &&`), the
    // short-circuit value for Telegram's real-but-falsy 0 is not `false` — it
    // is the number `0` itself, and JSX renders a bare number as a text node.
    // That leaks "0" straight into the <a>, as a sibling of the label span,
    // instead of suppressing it. `getByText("0")` alone can't tell the two
    // shapes apart: Testing Library's default text matcher only looks at an
    // element's own direct text-node children, and under the mutation the
    // <a> itself has such a child (the leaked "0"), so it satisfies the query
    // just as well as the correct <span> would. Asserting presence alone is
    // therefore vacuous — we must also assert *which* element matched.
    // tagName is the least brittle way to do that: it fails only if the "0"
    // moves off the counter <span>, not if the counter's classes are
    // restyled later.
    const telegramCount = screen.getByText("0");
    expect(telegramCount.tagName).toBe("SPAN");
    expect(screen.queryByText("null")).not.toBeInTheDocument();
  });

  it("opens external profiles safely", () => {
    render(<SocialLinks />);
    const link = screen.getByRole("link", { name: /Instagram/ });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
  });

  it("renders glass tiles in the tiles variant", () => {
    const { container } = render(<SocialLinks variant="tiles" />);
    expect(container.querySelector(".glass")).not.toBeNull();
  });

  it("hides the inline (footer) variant's label visually but keeps it accessible", () => {
    const { container } = render(<SocialLinks />);
    // Accessible name must still resolve — this is sr-only text, not a
    // removed label; getByRole's name computation reads it regardless of
    // the visual-hiding class.
    const link = screen.getByRole("link", { name: /Instagram/ });
    expect(link).toHaveAttribute("title", "Instagram");
    const label = container.querySelector("a span.sr-only");
    expect(label).not.toBeNull();
    expect(label?.textContent).toBe("Instagram");
  });

  it("keeps the tiles variant's label visible (no sr-only, no tooltip)", () => {
    const { container } = render(<SocialLinks variant="tiles" />);
    expect(container.querySelector("a span.sr-only")).toBeNull();
    expect(screen.getByText("Instagram")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Instagram/ })).not.toHaveAttribute("title");
  });
});

describe("formatFollowers boundary values", () => {
  const testCases = [
    { followers: 0, expected: "0" },
    { followers: 999, expected: "999" },
    { followers: 1000, expected: "1K" },
    { followers: 1500, expected: "1.5K" },
    { followers: 999_949, expected: "999.9K" },
    { followers: 999_950, expected: "1M" },
    { followers: 999_999, expected: "1M" },
    { followers: 1_000_000, expected: "1M" },
  ];

  testCases.forEach(({ followers, expected }) => {
    it(`formats ${followers.toLocaleString()} followers as "${expected}"`, () => {
      const originalSocials = mockSocials.slice();
      mockSocials.length = 0;
      mockSocials.push({
        platform: "instagram",
        label: "Instagram",
        href: "https://instagram.com/test",
        followers,
      });

      const { unmount } = render(<SocialLinks />);
      // Same footgun as the "shows a counter" test above applies to the
      // `followers: 0` case here: a regressed truthy guard leaks a bare "0"
      // text node into the <a> instead of suppressing it, and `getByText`
      // alone can't distinguish that from the intended <span> counter.
      // Asserting tagName keeps every case in this table honest about
      // *where* the formatted text renders, not just that it exists.
      expect(screen.getByText(expected).tagName).toBe("SPAN");
      unmount();

      mockSocials.length = 0;
      mockSocials.push(...originalSocials);
    });
  });
});
