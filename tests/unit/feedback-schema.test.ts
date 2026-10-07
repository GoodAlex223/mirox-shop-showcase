import { describe, it, expect } from "vitest";
import { feedbackSchema } from "@/lib/validations";

describe("feedbackSchema", () => {
  it("accepts a message-only submission", () => {
    const result = feedbackSchema.safeParse({ message: "Кнопка кошика не працює" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBeUndefined();
      expect(result.data.email).toBeUndefined();
    }
  });

  it("trims all fields", () => {
    const result = feedbackSchema.safeParse({
      name: "  Олена  ",
      email: "  olena@example.com  ",
      message: "  Каталог вантажиться повільно  ",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Олена");
      expect(result.data.email).toBe("olena@example.com");
      expect(result.data.message).toBe("Каталог вантажиться повільно");
    }
  });

  it("normalizes empty-string name and email to undefined", () => {
    const result = feedbackSchema.safeParse({
      name: "",
      email: "  ",
      message: "Все працює чудово",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBeUndefined();
      expect(result.data.email).toBeUndefined();
    }
  });

  it("rejects a missing message", () => {
    expect(feedbackSchema.safeParse({}).success).toBe(false);
  });

  it("rejects a message shorter than 5 characters after trimming", () => {
    expect(feedbackSchema.safeParse({ message: " ок  " }).success).toBe(false);
  });

  it("rejects a message over 2000 characters", () => {
    expect(feedbackSchema.safeParse({ message: "а".repeat(2001) }).success).toBe(false);
  });

  it("rejects an invalid email when one is given", () => {
    expect(
      feedbackSchema.safeParse({ email: "not-an-email", message: "Довге повідомлення" }).success
    ).toBe(false);
  });

  it("accepts the honeypot field without validating its content", () => {
    const result = feedbackSchema.safeParse({
      message: "Нормальний текст",
      website: "http://spam.example",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.website).toBe("http://spam.example");
  });

  it("never rejects the honeypot, even when a bot stuffs it", () => {
    const result = feedbackSchema.safeParse({
      message: "Нормальний текст",
      website: "x".repeat(5000),
    });
    expect(result.success).toBe(true);
  });
  // Boundary values on the ACCEPTING side. The rejection tests above cover
  // 4 chars and 2001 chars; these pin the first and last values that must
  // still pass, which is where an off-by-one in a `.min`/`.max` actually
  // shows up — a schema with `.min(6)` or `.max(1999)` passes every
  // rejection test in this file and fails only here.
  it("accepts a message of exactly 5 characters", () => {
    const result = feedbackSchema.safeParse({ message: "12345" });
    expect(result.success).toBe(true);
  });

  it("accepts a message of exactly 2000 characters", () => {
    const result = feedbackSchema.safeParse({ message: "я".repeat(2000) });
    expect(result.success).toBe(true);
  });

  it("accepts a name of exactly 100 characters and rejects 101", () => {
    const ok = feedbackSchema.safeParse({ name: "я".repeat(100), message: "Нормальний текст" });
    expect(ok.success).toBe(true);
    const tooLong = feedbackSchema.safeParse({
      name: "я".repeat(101),
      message: "Нормальний текст",
    });
    expect(tooLong.success).toBe(false);
  });
});
