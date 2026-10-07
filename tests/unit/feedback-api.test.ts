import { describe, it, expect, vi, beforeEach } from "vitest";
import { createNextRequest } from "../helpers/api-test-utils";

// api-utils.ts transitively imports next-auth via @/lib/auth — mock to keep
// vitest away from its ESM resolution.
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/email", () => ({
  sendFeedbackEmail: vi.fn().mockResolvedValue({ success: true }),
}));

import { sendFeedbackEmail } from "@/lib/email";
import { POST } from "@/app/api/feedback/route";

const mockSend = vi.mocked(sendFeedbackEmail);

function feedbackRequest(body: Record<string, unknown>) {
  return createNextRequest({ url: "/api/feedback", method: "POST", body });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockSend.mockResolvedValue({ success: true });
});

describe("POST /api/feedback", () => {
  it("returns 201 FEEDBACK_SENT and sends the email", async () => {
    const res = await POST(feedbackRequest({ message: "Кнопка кошика не працює" }));
    const data = await res.json();
    expect(res.status).toBe(201);
    expect(data.code).toBe("FEEDBACK_SENT");
    expect(mockSend).toHaveBeenCalledWith({
      name: undefined,
      email: undefined,
      message: "Кнопка кошика не працює",
    });
  });

  it("passes trimmed contact fields through and drops empty strings", async () => {
    await POST(
      feedbackRequest({ name: "  Олена ", email: "", message: " Каталог вантажиться повільно " })
    );
    expect(mockSend).toHaveBeenCalledWith({
      name: "Олена",
      email: undefined,
      message: "Каталог вантажиться повільно",
    });
  });

  it("returns 400 VALIDATION_ERROR when message is missing", async () => {
    const res = await POST(feedbackRequest({}));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("VALIDATION_ERROR");
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("returns 400 VALIDATION_ERROR when message is too short", async () => {
    const res = await POST(feedbackRequest({ message: "ок" }));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 VALIDATION_ERROR when message exceeds 2000 characters", async () => {
    const res = await POST(feedbackRequest({ message: "а".repeat(2001) }));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 VALIDATION_ERROR for an invalid email", async () => {
    const res = await POST(
      feedbackRequest({ email: "not-an-email", message: "Довге повідомлення" })
    );
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("VALIDATION_ERROR");
  });

  it("silently drops filled-honeypot submissions with a fake 201", async () => {
    const res = await POST(
      feedbackRequest({ message: "Цілком нормальний текст", website: "http://spam.example" })
    );
    expect(res.status).toBe(201);
    expect((await res.json()).code).toBe("FEEDBACK_SENT");
    expect(mockSend).not.toHaveBeenCalled();
  });

  // The drop test is `website && website.trim() !== ""`, so a honeypot holding
  // only whitespace is treated as EMPTY and the feedback is sent for real.
  // That is the deliberate fail-open choice — a stray space from an
  // autofill/proxy must not silently swallow a genuine message — and it is
  // pinned here because the guard is one `.trim()` away from the opposite
  // behavior, with no user-visible signal either way.
  it("treats a whitespace-only honeypot as unfilled and sends the feedback", async () => {
    const res = await POST(feedbackRequest({ message: "Цілком нормальний текст", website: "   " }));
    expect(res.status).toBe(201);
    expect((await res.json()).code).toBe("FEEDBACK_SENT");
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it("returns 500 SEND_FAILED when the send reports failure", async () => {
    mockSend.mockResolvedValue({ success: false, error: "FEEDBACK_EMAIL not configured" });
    const res = await POST(feedbackRequest({ message: "Довге повідомлення" }));
    expect(res.status).toBe(500);
    expect((await res.json()).code).toBe("SEND_FAILED");
  });

  it("returns 500 SEND_FAILED when the send throws", async () => {
    mockSend.mockRejectedValue(new Error("network down"));
    const res = await POST(feedbackRequest({ message: "Довге повідомлення" }));
    expect(res.status).toBe(500);
    expect((await res.json()).code).toBe("SEND_FAILED");
  });
});
