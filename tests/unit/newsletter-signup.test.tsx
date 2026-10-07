import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { renderWithIntl } from "../helpers/render-with-intl";

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

import { NewsletterSignup } from "@/components/common/NewsletterSignup";
import { toast } from "sonner";

function stubFetch(response: { ok: boolean; body: Record<string, unknown> }) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: response.ok,
      json: async () => response.body,
    })
  );
}

function stubFetchReject(error: Error) {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(error));
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("NewsletterSignup form", () => {
  it("maps ALREADY_SUBSCRIBED code to newsletter content", async () => {
    stubFetch({ ok: false, body: { code: "ALREADY_SUBSCRIBED" } });
    renderWithIntl(<NewsletterSignup />);

    const input = screen.getByPlaceholderText("Ваш email");
    fireEvent.change(input, { target: { value: "test@example.com" } });
    fireEvent.submit(input.closest("form")!);

    await waitFor(() => {
      expect(vi.mocked(toast.error)).toHaveBeenCalledWith("Цей email уже підписаний на розсилку");
    });
  });

  it("falls back to generic copy for unknown error code", async () => {
    stubFetch({ ok: false, body: { code: "SOMETHING_NEW" } });
    renderWithIntl(<NewsletterSignup />);

    const input = screen.getByPlaceholderText("Ваш email");
    fireEvent.change(input, { target: { value: "test@example.com" } });
    fireEvent.submit(input.closest("form")!);

    await waitFor(() => {
      expect(vi.mocked(toast.error)).toHaveBeenCalledWith("Не вдалося підписатися");
    });
  });

  it("falls back to generic copy on fetch rejection", async () => {
    stubFetchReject(new Error("Network error"));
    renderWithIntl(<NewsletterSignup />);

    const input = screen.getByPlaceholderText("Ваш email");
    fireEvent.change(input, { target: { value: "test@example.com" } });
    fireEvent.submit(input.closest("form")!);

    await waitFor(() => {
      expect(vi.mocked(toast.error)).toHaveBeenCalledWith("Не вдалося підписатися");
    });
  });

  it("shows success box on ok response and does not show error toast", async () => {
    stubFetch({ ok: true, body: { message: "Check your email" } });
    renderWithIntl(<NewsletterSignup />);

    const input = screen.getByPlaceholderText("Ваш email");
    fireEvent.change(input, { target: { value: "test@example.com" } });
    fireEvent.submit(input.closest("form")!);

    await waitFor(() => {
      expect(screen.getByText("Перевірте пошту, щоб підтвердити підписку!")).toBeInTheDocument();
      expect(vi.mocked(toast.error)).not.toHaveBeenCalled();
    });
    expect(vi.mocked(toast.success)).toHaveBeenCalledWith(
      "Перевірте пошту, щоб підтвердити підписку"
    );
  });
});
