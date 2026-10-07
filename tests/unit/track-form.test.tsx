import { screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderWithIntl } from "../helpers/render-with-intl";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
const push = vi.fn();
let search = "";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams(search),
}));

import { toast } from "sonner";
import { TrackForm } from "@/app/(shop)/track/track-form";

const fetchMock = vi.fn();
const ORDER = "ORD-MF2K1X9Q-A7B3";

beforeEach(() => {
  vi.clearAllMocks();
  search = "";
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

function submit(orderNumber: string, email: string) {
  fireEvent.change(screen.getByLabelText("Номер замовлення"), { target: { value: orderNumber } });
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: email } });
  fireEvent.click(screen.getByRole("button", { name: "Перевірити" }));
}

describe("TrackForm", () => {
  it("marks the form hydrated after mount (WebKit pre-hydration fill guard)", async () => {
    renderWithIntl(<TrackForm />);
    await waitFor(() =>
      expect(document.querySelector('form[data-hydrated="true"]')).not.toBeNull()
    );
  });

  it("prefills the order number from ?order=", () => {
    search = `order=${ORDER}`;
    renderWithIntl(<TrackForm />);
    expect(screen.getByLabelText("Номер замовлення")).toHaveValue(ORDER);
  });

  it("posts the pair and navigates to the status page on success", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ orderNumber: ORDER }) });
    renderWithIntl(<TrackForm />);
    submit(ORDER, "guest@example.com");
    await waitFor(() => expect(push).toHaveBeenCalledWith(`/track/${ORDER}`));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/orders/lookup");
    expect(JSON.parse(init.body)).toEqual({ orderNumber: ORDER, email: "guest@example.com" });
  });

  it("maps ORDER_NOT_FOUND to the Ukrainian toast and keeps the form on screen", async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ code: "ORDER_NOT_FOUND" }) });
    renderWithIntl(<TrackForm />);
    submit(ORDER, "wrong@example.com");
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Замовлення з таким номером та email не знайдено. Перевірте дані та спробуйте ще раз."
      )
    );
    expect(push).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Перевірити" })).toBeInTheDocument();
  });

  it("renders the lockout minutes from retryAfterSeconds", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      json: async () => ({ code: "TOO_MANY_ATTEMPTS", retryAfterSeconds: 601 }),
    });
    renderWithIntl(<TrackForm />);
    submit(ORDER, "guest@example.com");
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Забагато спроб. Спробуйте знову через 11 хв.")
    );
  });

  it("falls back to the generic copy for an unknown code and for a network failure", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, json: async () => ({ code: "SOMETHING_NEW" }) });
    renderWithIntl(<TrackForm />);
    submit(ORDER, "guest@example.com");
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Не вдалося перевірити замовлення. Спробуйте пізніше."
      )
    );
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    fireEvent.click(screen.getByRole("button", { name: "Перевірити" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(2));
  });
});
