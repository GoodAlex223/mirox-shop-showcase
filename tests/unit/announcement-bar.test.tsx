import { screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { SiteAnnouncement } from "@/content/site";
import { renderWithIntl } from "../helpers/render-with-intl";

const mockSite = {
  announcement: null as SiteAnnouncement | null,
};
vi.mock("@/content/site", () => ({
  get site() {
    return mockSite;
  },
}));

import { AnnouncementBar } from "@/components/common/AnnouncementBar";

// text/linkLabel/announcementDismiss are catalog-sourced (TASK-039 G9), not
// config — real messages/uk.json values, hardcoded here to match the
// established sibling-test convention (e.g. header.test.tsx) rather than
// importing the JSON, since renderWithIntl already renders the real catalog.
const TEXT = "Ми відкрилися! Новий сайт Mirox уже працює. Помітили проблему або маєте пропозицію?";
const LINK_LABEL = "Розкажіть нам через форму зворотного зв'язку";
const DISMISS_LABEL = "Приховати оголошення";

const LAUNCH: SiteAnnouncement = {
  id: "launch-2026-08",
  href: "/feedback",
  marquee: true,
};

beforeEach(() => {
  window.localStorage.clear();
  mockSite.announcement = { ...LAUNCH };
});

afterEach(() => {
  window.localStorage.clear();
});

describe("AnnouncementBar", () => {
  it("renders nothing when no announcement is configured", () => {
    mockSite.announcement = null;
    const { container } = renderWithIntl(<AnnouncementBar />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders the text plain and the fixed catalog label as the link", () => {
    renderWithIntl(<AnnouncementBar />);
    const link = screen.getByRole("link", { name: LINK_LABEL });
    expect(link).toHaveAttribute("href", "/feedback");
    // The announcement text itself is NOT inside the link (the link's own
    // content is only the label — text and link are rendered as siblings
    // under a shared wrapper, not text-inside-anchor).
    expect(link.textContent).not.toContain(TEXT);
  });

  // The pre-G9 "linkLabel: null → whole text becomes the single link" mode
  // is no longer reachable: the trimmed SiteAnnouncement config shape
  // (`{ id, href, marquee }`) has no field left to express "no distinct
  // label" — text/linkLabel are now always-present fixed catalog strings.
  // That render branch was removed from AnnouncementBar.tsx along with it.

  it("renders aria-hidden duplicates that are clickable but out of the tab order", () => {
    const { container } = renderWithIntl(<AnnouncementBar />);
    expect(container.querySelector(".animate-marquee")).not.toBeNull();
    const dupes = container.querySelectorAll(".marquee-duplicate");
    expect(dupes.length).toBeGreaterThanOrEqual(1);
    dupes.forEach((dupe) => {
      expect(dupe.getAttribute("aria-hidden")).toBe("true");
      const link = dupe.querySelector("a");
      // Real link: every visible pill is mouse-clickable (gate ruling 8)…
      expect(link).not.toBeNull();
      expect(link!.getAttribute("href")).toBe("/feedback");
      // …but out of the tab order, so copy 1 stays the only tab stop.
      expect(link!.getAttribute("tabindex")).toBe("-1");
    });
    // Exactly one link in the accessibility tree (aria-hidden excluded).
    expect(screen.getAllByRole("link", { name: LINK_LABEL })).toHaveLength(1);
  });

  it("renders the static centered variant without a duplicate when marquee is off", () => {
    mockSite.announcement = { ...LAUNCH, marquee: false };
    const { container } = renderWithIntl(<AnnouncementBar />);
    expect(container.querySelector(".animate-marquee")).toBeNull();
    expect(container.querySelector(".marquee-duplicate")).toBeNull();
    expect(screen.getByText(TEXT)).toBeInTheDocument();
  });

  it("stays hidden when the id-scoped dismissal key is set", () => {
    // Non-vacuous only because AnnouncementBar reads the real snapshot
    // (useSyncExternalStore's getSnapshot) on this very first render pass
    // under RTL's non-hydrating render().
    window.localStorage.setItem("mirox:announcement-dismissed:launch-2026-08", "1");
    const { container } = renderWithIntl(<AnnouncementBar />);
    expect(container).toBeEmptyDOMElement();
  });

  it("ignores a different announcement's dismissal (id scoping)", () => {
    window.localStorage.setItem("mirox:announcement-dismissed:old-promo", "1");
    renderWithIntl(<AnnouncementBar />);
    // The link's accessible name is the (fixed catalog) linkLabel, not the
    // full text — see the "renders the text plain..." case above.
    expect(screen.getByRole("link", { name: LINK_LABEL })).toBeInTheDocument();
  });

  it("dismisses via the UA-labelled control and persists under the id-scoped key", () => {
    renderWithIntl(<AnnouncementBar />);

    fireEvent.click(screen.getByRole("button", { name: DISMISS_LABEL }));

    expect(screen.queryByText(TEXT)).not.toBeInTheDocument();
    expect(window.localStorage.getItem("mirox:announcement-dismissed:launch-2026-08")).toBe("1");
  });
  // A late webfont swap changes the width of the marquee COPY, not the
  // viewport — so observing only the viewport leaves `--marquee-shift` stuck
  // at its pre-swap value and the stream shows a seam where the shift no
  // longer equals one copy width. Observing the first copy as well is what
  // makes either resize re-measure. (G8 residue item 2, PR #35 re-review.)
  it("observes the first copy as well as the viewport, so a font swap re-measures", () => {
    const observed: Element[] = [];
    const disconnect = vi.fn();
    class StubResizeObserver {
      observe(target: Element) {
        observed.push(target);
      }
      unobserve() {}
      disconnect = disconnect;
    }
    const original = (globalThis as { ResizeObserver?: unknown }).ResizeObserver;
    (globalThis as { ResizeObserver?: unknown }).ResizeObserver = StubResizeObserver;

    try {
      const { container, unmount } = renderWithIntl(<AnnouncementBar />);

      const track = container.querySelector(".animate-marquee");
      expect(track).not.toBeNull();
      const viewport = track!.parentElement;
      const firstCopy = track!.querySelector("span:not(.marquee-duplicate)");
      expect(viewport).not.toBeNull();
      expect(firstCopy).not.toBeNull();

      // Identity, not count: asserting `observed.length === 2` would pass if
      // the viewport were observed twice.
      expect(observed).toContain(viewport);
      expect(observed).toContain(firstCopy);

      // One observer, so the existing single disconnect() still tears both down.
      unmount();
      expect(disconnect).toHaveBeenCalled();
    } finally {
      (globalThis as { ResizeObserver?: unknown }).ResizeObserver = original;
    }
  });
});
