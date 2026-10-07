import { screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderWithIntl } from "../helpers/render-with-intl";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import { toast } from "sonner";
import { FeedbackForm } from "@/app/(shop)/feedback/feedback-form";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("FeedbackForm", () => {
  it("submits message-only feedback and shows the success box", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ code: "FEEDBACK_SENT" }) });
    renderWithIntl(<FeedbackForm />);

    fireEvent.change(screen.getByLabelText("Повідомлення"), {
      target: { value: "Кнопка кошика не працює" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Надіслати" }));

    await waitFor(() => expect(screen.getByText("Дякуємо!")).toBeInTheDocument());
    expect(screen.getByRole("status")).toHaveTextContent("Дякуємо!");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/feedback");
    expect(JSON.parse(init.body).message).toBe("Кнопка кошика не працює");
  });

  it("keeps the honeypot field out of sight and out of the tab order", () => {
    renderWithIntl(<FeedbackForm />);
    const honeypot = document.querySelector('input[name="website"]');
    expect(honeypot).not.toBeNull();
    expect(honeypot!.getAttribute("tabindex")).toBe("-1");
    expect(honeypot!.closest('div[aria-hidden="true"]')).not.toBeNull();
  });

  it("maps SEND_FAILED to the Ukrainian toast and keeps the form on screen", async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ code: "SEND_FAILED" }) });
    renderWithIntl(<FeedbackForm />);

    fireEvent.change(screen.getByLabelText("Повідомлення"), {
      target: { value: "Каталог вантажиться повільно" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Надіслати" }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Не вдалося надіслати повідомлення. Спробуйте пізніше."
      )
    );
    expect(screen.getByRole("button", { name: "Надіслати" })).toBeInTheDocument();
  });

  it("toasts the validation copy instead of silently ignoring a whitespace-only message", async () => {
    renderWithIntl(<FeedbackForm />);

    fireEvent.change(screen.getByLabelText("Повідомлення"), { target: { value: "     " } });
    fireEvent.click(screen.getByRole("button", { name: "Надіслати" }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Перевірте заповнені поля — щось не так.")
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // Distinct from the whitespace test below: there the CLIENT short-circuits
  // before any request. Here the request goes out and the SERVER answers 400
  // VALIDATION_ERROR — the byCode branch, which resolves to different copy
  // than the SEND_FAILED/fallback string every other error path shows.
  it("maps a server VALIDATION_ERROR to its own toast copy, not the generic fallback", async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ code: "VALIDATION_ERROR" }) });
    renderWithIntl(<FeedbackForm />);

    fireEvent.change(screen.getByLabelText("Повідомлення"), {
      target: { value: "Достатньо довге повідомлення" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Надіслати" }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Перевірте заповнені поля — щось не так.")
    );
    // Asserting the fallback was NOT used is the half with teeth: both
    // branches call toast.error, so a broken t.has() guard would still toast.
    expect(toast.error).not.toHaveBeenCalledWith(
      "Не вдалося надіслати повідомлення. Спробуйте пізніше."
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to the generic Ukrainian error when fetch rejects", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    renderWithIntl(<FeedbackForm />);

    fireEvent.change(screen.getByLabelText("Повідомлення"), {
      target: { value: "Каталог вантажиться повільно" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Надіслати" }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Не вдалося надіслати повідомлення. Спробуйте пізніше."
      )
    );
  });
});
