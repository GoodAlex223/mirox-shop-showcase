import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderWithIntl } from "../helpers/render-with-intl";
import AdminCustomersPage from "@/app/(admin)/admin/customers/page";

const customersResponse = {
  data: [
    {
      id: "c1",
      name: "Тест Клієнт",
      email: "test@example.com",
      image: null,
      createdAt: "2026-08-01T00:00:00.000Z",
      orderCount: 2,
      totalSpent: 1290,
    },
  ],
  pagination: { page: 1, limit: 20, total: 1, totalPages: 1, hasNext: false, hasPrev: false },
};

describe("AdminCustomersPage", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => customersResponse })
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetches the list exactly once (no unstable-toast refetch loop)", async () => {
    renderWithIntl(<AdminCustomersPage />);
    await screen.findByText("test@example.com");
    // Give the old bug room to refire: state settled + a few macrotask turns.
    await new Promise((r) => setTimeout(r, 50));
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
  });

  it("renders Ukrainian headers from the catalog", async () => {
    renderWithIntl(<AdminCustomersPage />);
    await screen.findByText("test@example.com");
    expect(screen.getByRole("heading", { name: "Клієнти" })).toBeInTheDocument();
  });
});
