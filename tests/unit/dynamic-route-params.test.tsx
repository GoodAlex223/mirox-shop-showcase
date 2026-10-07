import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderWithIntl } from "../helpers/render-with-intl";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "test-id" }),
  useRouter: () => ({ push }),
}));
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));
// EditProductPage only renders ProductForm after a successful load, but the
// admin barrel import is heavy — stub the module.
vi.mock("@/components/admin", () => ({
  ProductForm: () => null,
}));

import AdminOrderDetailPage from "@/app/(admin)/admin/orders/[id]/page";
import EditProductPage from "@/app/(admin)/admin/products/[id]/page";
import SupplierDetailPage from "@/app/(admin)/admin/suppliers/[id]/page";
import AccountOrderDetailPage from "@/app/(shop)/account/orders/[id]/page";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: false, status: 404, json: async () => ({}) })
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// Regression for BACKLOG [2026-07-18]: on Next 14.2.35 these four client pages
// 500'd calling use(params) — params arrives as a plain object, not a Promise.
// Each test proves the page (a) renders without throwing and (b) feeds the
// route id into its fetch URL (non-vacuous: id must actually flow).
describe("dynamic-route params regression (use(params) → useParams)", () => {
  it("/admin/orders/[id] renders and fetches by route id", async () => {
    // renderWithIntl: the page now calls useTranslations (G13 Task 7).
    renderWithIntl(<AdminOrderDetailPage />);
    expect(await screen.findByText("Замовлення не знайдено")).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith("/api/admin/orders/test-id");
  });

  it("/admin/products/[id] renders and fetches by route id", async () => {
    // renderWithIntl: the page now calls useTranslations (G13 Task 10) — all
    // four pages in this file are now translated.
    // "Товар не знайдено" appears twice in the error state (h2 + error <p>,
    // since the 404 branch's thrown Error message is also t("notFound")).
    renderWithIntl(<EditProductPage />);
    expect((await screen.findAllByText("Товар не знайдено")).length).toBeGreaterThan(0);
    expect(global.fetch).toHaveBeenCalledWith("/api/admin/products/test-id");
  });

  it("/admin/suppliers/[id] renders and fetches by route id", async () => {
    // renderWithIntl: the page now calls useTranslations (G13 Task 9).
    // 404 path: toast.error + redirect back to the list — no crash is the point
    renderWithIntl(<SupplierDetailPage />);
    await waitFor(() => expect(push).toHaveBeenCalledWith("/admin/suppliers"));
    expect(global.fetch).toHaveBeenCalledWith("/api/admin/suppliers/test-id");
  });

  it("/account/orders/[id] renders and fetches by route id", async () => {
    // renderWithIntl: the page calls useTranslations (TASK-039 Task 5). All
    // four pages in this file now call useTranslations/getTranslations.
    renderWithIntl(<AccountOrderDetailPage />);
    expect(await screen.findByText("Замовлення не знайдено")).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith("/api/orders/test-id");
  });
});
