import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderWithIntl } from "../helpers/render-with-intl";
import {
  RecentlyViewed,
  readRecentlyViewed,
  recordRecentlyViewed,
} from "@/components/products/RecentlyViewed";

const originalFetch = global.fetch;

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  global.fetch = originalFetch;
});

describe("recently-viewed storage", () => {
  it("records newest-first, dedupes, caps at 8", () => {
    for (let i = 1; i <= 10; i++) recordRecentlyViewed(`p${i}`);
    recordRecentlyViewed("p9");
    const ids = readRecentlyViewed();
    expect(ids).toHaveLength(8);
    expect(ids[0]).toBe("p9");
    expect(ids).not.toContain("p1");
  });

  it("survives corrupted storage", () => {
    localStorage.setItem("mirox:recently-viewed", "{not json");
    expect(readRecentlyViewed()).toEqual([]);
  });
});

describe("<RecentlyViewed />", () => {
  it("records the current product and renders nothing with no other history", () => {
    global.fetch = vi.fn();
    const { container } = renderWithIntl(<RecentlyViewed currentProductId="cur" />);
    expect(readRecentlyViewed()).toEqual(["cur"]);
    expect(container).toBeEmptyDOMElement();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("fetches other recorded ids and renders the section", async () => {
    recordRecentlyViewed("other1");
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            id: "other1",
            name: "Футболка Mirox",
            slug: "futbolka-mirox",
            price: "590",
            comparePrice: null,
            stock: 10,
            images: [],
            variants: [],
          },
        ],
      }),
    });
    renderWithIntl(<RecentlyViewed currentProductId="cur" />);
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Ви нещодавно переглянули" })).toBeInTheDocument()
    );
    expect(screen.getByText("Футболка Mirox")).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith("/api/products?ids=other1&limit=12");
  });

  it("renders nothing when the fetch fails", async () => {
    recordRecentlyViewed("other1");
    global.fetch = vi.fn().mockRejectedValue(new Error("network"));
    const { container } = renderWithIntl(<RecentlyViewed currentProductId="cur" />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });
});
