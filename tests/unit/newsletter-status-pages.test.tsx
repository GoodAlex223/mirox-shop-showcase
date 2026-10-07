import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { renderWithIntl } from "../helpers/render-with-intl";

const searchParamsGet = vi.fn();
vi.mock("next/navigation", () => ({
  useSearchParams: () => ({ get: searchParamsGet }),
}));

import NewsletterConfirmPage from "@/app/newsletter/confirm/page";
import NewsletterUnsubscribePage from "@/app/newsletter/unsubscribe/page";

function stubFetch(response: { ok: boolean; body: Record<string, unknown> }) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: response.ok, json: async () => response.body })
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("newsletter confirm page", () => {
  it("shows the success copy for CONFIRMED", async () => {
    searchParamsGet.mockReturnValue("tok-1");
    stubFetch({ ok: true, body: { code: "CONFIRMED", message: "en text" } });
    renderWithIntl(<NewsletterConfirmPage />);
    expect(await screen.findByText("Підписку підтверджено!")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Продовжити покупки" })).toHaveAttribute("href", "/");
  });

  it("distinguishes ALREADY_CONFIRMED from CONFIRMED", async () => {
    searchParamsGet.mockReturnValue("tok-1");
    stubFetch({ ok: true, body: { code: "ALREADY_CONFIRMED" } });
    renderWithIntl(<NewsletterConfirmPage />);
    expect(await screen.findByText("Підписку вже підтверджено")).toBeInTheDocument();
  });

  it("shows the expired copy for LINK_EXPIRED", async () => {
    searchParamsGet.mockReturnValue("tok-1");
    stubFetch({ ok: false, body: { code: "LINK_EXPIRED", error: "en text" } });
    renderWithIntl(<NewsletterConfirmPage />);
    expect(await screen.findByText("Посилання застаріло")).toBeInTheDocument();
  });

  it("falls back to generic Ukrainian copy on an unknown code", async () => {
    searchParamsGet.mockReturnValue("tok-1");
    stubFetch({ ok: false, body: { code: "SOMETHING_NEW" } });
    renderWithIntl(<NewsletterConfirmPage />);
    expect(await screen.findByText("Щось пішло не так")).toBeInTheDocument();
  });

  it("shows invalid-link copy without fetching when token is missing", () => {
    searchParamsGet.mockReturnValue(null);
    stubFetch({ ok: true, body: {} });
    renderWithIntl(<NewsletterConfirmPage />);
    expect(screen.getByText("Недійсне посилання")).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe("newsletter unsubscribe page", () => {
  it("prompts with the email, then shows success after confirming", async () => {
    searchParamsGet.mockImplementation((key: string) =>
      key === "email" ? "a@b.ua" : "valid-token"
    );
    stubFetch({ ok: true, body: { code: "UNSUBSCRIBED", message: "en" } });
    renderWithIntl(<NewsletterUnsubscribePage />);
    expect(screen.getByText(/a@b\.ua/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Так, відписатися" }));
    await waitFor(() => expect(screen.getByText("Ви відписалися")).toBeInTheDocument());
  });

  it("shows invalid-link copy when params are missing", () => {
    searchParamsGet.mockReturnValue(null);
    renderWithIntl(<NewsletterUnsubscribePage />);
    expect(screen.getByText("Недійсне посилання")).toBeInTheDocument();
  });

  it("maps error codes through the content layer", async () => {
    searchParamsGet.mockImplementation((key: string) => (key === "email" ? "a@b.ua" : "bad-token"));
    stubFetch({ ok: false, body: { code: "INVALID_UNSUBSCRIBE_LINK", error: "en" } });
    renderWithIntl(<NewsletterUnsubscribePage />);
    fireEvent.click(screen.getByRole("button", { name: "Так, відписатися" }));
    await waitFor(() => expect(screen.getByText("Недійсне посилання")).toBeInTheDocument());
  });
});
