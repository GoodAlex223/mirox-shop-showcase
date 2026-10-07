import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { sendMock } = vi.hoisted(() => ({ sendMock: vi.fn() }));

vi.mock("resend", () => ({
  Resend: class {
    emails = { send: sendMock };
  },
}));

const originalEnv = { ...process.env };

// email.ts freezes RESEND_API_KEY at import — set env BEFORE a fresh import.
async function importEmailModule() {
  vi.resetModules();
  return await import("@/lib/email");
}

beforeEach(() => {
  sendMock.mockReset();
  sendMock.mockResolvedValue({ error: null });
});

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("sendFeedbackEmail", () => {
  it("log-skips and succeeds when RESEND_API_KEY is unset (local dev)", async () => {
    delete process.env.RESEND_API_KEY;
    const { sendFeedbackEmail } = await importEmailModule();
    const result = await sendFeedbackEmail({ message: "Привіт з форми" });
    expect(result.success).toBe(true);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("fails loud when Resend is configured but FEEDBACK_EMAIL is unset", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    delete process.env.FEEDBACK_EMAIL;
    const { sendFeedbackEmail } = await importEmailModule();
    const result = await sendFeedbackEmail({ message: "Привіт з форми" });
    expect(result.success).toBe(false);
    expect(result.error).toContain("FEEDBACK_EMAIL");
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("sends to FEEDBACK_EMAIL with Reply-To when the visitor left an email", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.FEEDBACK_EMAIL = "owner@example.com";
    const { sendFeedbackEmail } = await importEmailModule();
    const result = await sendFeedbackEmail({
      name: "Олена",
      email: "olena@example.com",
      message: "Кнопка кошика не працює",
    });
    expect(result.success).toBe(true);
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "owner@example.com",
        replyTo: "olena@example.com",
        subject: expect.stringContaining("Новий відгук"),
        html: expect.stringContaining("Кнопка кошика не працює"),
      })
    );
  });

  it("omits Reply-To when no email was provided", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.FEEDBACK_EMAIL = "owner@example.com";
    const { sendFeedbackEmail } = await importEmailModule();
    await sendFeedbackEmail({ message: "Анонімний відгук про сайт" });
    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sendMock.mock.calls[0][0]).not.toHaveProperty("replyTo");
  });

  it("returns failure when Resend reports an error", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.FEEDBACK_EMAIL = "owner@example.com";
    sendMock.mockResolvedValue({ error: { message: "boom" } });
    const { sendFeedbackEmail } = await importEmailModule();
    const result = await sendFeedbackEmail({ message: "Довге повідомлення" });
    expect(result).toEqual({ success: false, error: "boom" });
  });
});
