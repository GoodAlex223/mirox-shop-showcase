import { describe, it, expect, vi, beforeEach } from "vitest";
import { createNextRequest } from "../helpers/api-test-utils";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// api-utils.ts imports @/lib/auth which transitively imports next-auth.
// Mock it to prevent ESM resolution issues with next/server in vitest.
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    subscriber: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/email", () => ({
  sendNewsletterConfirmationEmail: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("@/lib/newsletter", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    generateConfirmationToken: vi.fn(() => "mock-token-abc123"),
    getTokenExpiry: vi.fn(() => new Date("2025-01-02T00:00:00Z")),
  };
});

import { prisma } from "@/lib/db";
import { sendNewsletterConfirmationEmail } from "@/lib/email";
import { POST as POSTSubscribe } from "@/app/api/newsletter/subscribe/route";
import { GET as GETConfirm } from "@/app/api/newsletter/confirm/route";
import { POST as POSTUnsubscribe } from "@/app/api/newsletter/unsubscribe/route";

beforeEach(() => {
  vi.clearAllMocks();
});

// ===========================================================================
// POST /api/newsletter/subscribe
// ===========================================================================

describe("POST /api/newsletter/subscribe", () => {
  it("returns 400 on validation error (invalid email)", async () => {
    const req = createNextRequest({
      url: "/api/newsletter/subscribe",
      method: "POST",
      body: { email: "not-an-email" },
    });
    const res = await POSTSubscribe(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("VALIDATION_ERROR");
  });

  it("returns 409 when email is already active", async () => {
    vi.mocked(prisma.subscriber.findUnique).mockResolvedValue({
      id: "sub-1",
      email: "test@example.com",
      status: "ACTIVE",
    } as never);

    const req = createNextRequest({
      url: "/api/newsletter/subscribe",
      method: "POST",
      body: { email: "test@example.com" },
    });
    const res = await POSTSubscribe(req);

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain("already subscribed");
    expect(body.code).toBe("ALREADY_SUBSCRIBED");
  });

  it("creates new subscriber with PENDING status", async () => {
    vi.mocked(prisma.subscriber.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.subscriber.create).mockResolvedValue({
      id: "sub-new",
      email: "new@example.com",
    } as never);

    const req = createNextRequest({
      url: "/api/newsletter/subscribe",
      method: "POST",
      body: { email: "New@Example.COM" },
    });
    const res = await POSTSubscribe(req);

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.code).toBe("CONFIRMATION_PENDING");
    expect(prisma.subscriber.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: "new@example.com",
          confirmationToken: "mock-token-abc123",
        }),
      })
    );
    expect(sendNewsletterConfirmationEmail).toHaveBeenCalled();
  });

  it("normalizes email to lowercase", async () => {
    vi.mocked(prisma.subscriber.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.subscriber.create).mockResolvedValue({
      id: "sub-1",
      email: "test@example.com",
    } as never);

    const req = createNextRequest({
      url: "/api/newsletter/subscribe",
      method: "POST",
      body: { email: "TEST@Example.COM" },
    });
    await POSTSubscribe(req);

    // Route normalizes email with toLowerCase().trim() before Prisma lookup
    expect(prisma.subscriber.findUnique).toHaveBeenCalledWith({
      where: { email: "test@example.com" },
    });
  });

  it("re-subscribes existing UNSUBSCRIBED subscriber", async () => {
    vi.mocked(prisma.subscriber.findUnique).mockResolvedValue({
      id: "sub-1",
      email: "test@example.com",
      status: "UNSUBSCRIBED",
    } as never);
    vi.mocked(prisma.subscriber.update).mockResolvedValue({
      id: "sub-1",
      email: "test@example.com",
    } as never);

    const req = createNextRequest({
      url: "/api/newsletter/subscribe",
      method: "POST",
      body: { email: "test@example.com" },
    });
    const res = await POSTSubscribe(req);

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.code).toBe("CONFIRMATION_PENDING");
    expect(prisma.subscriber.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "sub-1" },
        data: expect.objectContaining({
          status: "PENDING",
          confirmationToken: "mock-token-abc123",
        }),
      })
    );
  });

  it("re-subscribes existing PENDING subscriber (resend confirmation)", async () => {
    vi.mocked(prisma.subscriber.findUnique).mockResolvedValue({
      id: "sub-1",
      email: "test@example.com",
      status: "PENDING",
    } as never);
    vi.mocked(prisma.subscriber.update).mockResolvedValue({
      id: "sub-1",
      email: "test@example.com",
    } as never);

    const req = createNextRequest({
      url: "/api/newsletter/subscribe",
      method: "POST",
      body: { email: "test@example.com" },
    });
    const res = await POSTSubscribe(req);

    expect(res.status).toBe(201);
    expect(sendNewsletterConfirmationEmail).toHaveBeenCalled();
  });

  it("returns 201 even if email send fails", async () => {
    vi.mocked(prisma.subscriber.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.subscriber.create).mockResolvedValue({
      id: "sub-1",
      email: "test@example.com",
    } as never);
    vi.mocked(sendNewsletterConfirmationEmail).mockResolvedValue({
      success: false,
      error: "Email service down",
    });

    const req = createNextRequest({
      url: "/api/newsletter/subscribe",
      method: "POST",
      body: { email: "test@example.com" },
    });
    const res = await POSTSubscribe(req);

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.code).toBe("CONFIRMATION_PENDING");
  });
});

// ===========================================================================
// GET /api/newsletter/confirm
// ===========================================================================

describe("GET /api/newsletter/confirm", () => {
  it("returns 400 when token is missing", async () => {
    const req = createNextRequest({ url: "/api/newsletter/confirm" });
    const res = await GETConfirm(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("token");
    expect(body.code).toBe("TOKEN_REQUIRED");
  });

  it("returns 404 when token is invalid", async () => {
    vi.mocked(prisma.subscriber.findUnique).mockResolvedValue(null);

    const req = createNextRequest({
      url: "/api/newsletter/confirm",
      searchParams: { token: "invalid-token" },
    });
    const res = await GETConfirm(req);

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.code).toBe("INVALID_TOKEN");
  });

  it("returns success when already active", async () => {
    vi.mocked(prisma.subscriber.findUnique).mockResolvedValue({
      id: "sub-1",
      status: "ACTIVE",
      confirmationToken: "valid-token",
    } as never);

    const req = createNextRequest({
      url: "/api/newsletter/confirm",
      searchParams: { token: "valid-token" },
    });
    const res = await GETConfirm(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toContain("already confirmed");
    expect(body.code).toBe("ALREADY_CONFIRMED");
  });

  it("returns 410 when token is expired", async () => {
    vi.mocked(prisma.subscriber.findUnique).mockResolvedValue({
      id: "sub-1",
      status: "PENDING",
      confirmationToken: "expired-token",
      confirmationExpiry: new Date("2020-01-01"),
    } as never);

    const req = createNextRequest({
      url: "/api/newsletter/confirm",
      searchParams: { token: "expired-token" },
    });
    const res = await GETConfirm(req);

    expect(res.status).toBe(410);
    const body = await res.json();
    expect(body.error).toContain("expired");
    expect(body.code).toBe("LINK_EXPIRED");
  });

  it("returns 410 when confirmationExpiry is null", async () => {
    vi.mocked(prisma.subscriber.findUnique).mockResolvedValue({
      id: "sub-1",
      status: "PENDING",
      confirmationToken: "token",
      confirmationExpiry: null,
    } as never);

    const req = createNextRequest({
      url: "/api/newsletter/confirm",
      searchParams: { token: "token" },
    });
    const res = await GETConfirm(req);

    expect(res.status).toBe(410);
    const body = await res.json();
    expect(body.code).toBe("LINK_EXPIRED");
  });

  it("activates subscriber and clears token", async () => {
    vi.mocked(prisma.subscriber.findUnique).mockResolvedValue({
      id: "sub-1",
      status: "PENDING",
      confirmationToken: "valid-token",
      confirmationExpiry: new Date("2099-01-01"),
    } as never);
    vi.mocked(prisma.subscriber.update).mockResolvedValue({} as never);

    const req = createNextRequest({
      url: "/api/newsletter/confirm",
      searchParams: { token: "valid-token" },
    });
    const res = await GETConfirm(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toContain("confirmed");
    expect(body.code).toBe("CONFIRMED");

    expect(prisma.subscriber.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "sub-1" },
        data: expect.objectContaining({
          status: "ACTIVE",
          confirmationToken: null,
          confirmationExpiry: null,
        }),
      })
    );
  });
});

// ===========================================================================
// POST /api/newsletter/unsubscribe
// ===========================================================================

describe("POST /api/newsletter/unsubscribe", () => {
  it("returns 400 on validation error (missing email)", async () => {
    const req = createNextRequest({
      url: "/api/newsletter/unsubscribe",
      method: "POST",
      body: { token: "some-token" },
    });
    const res = await POSTUnsubscribe(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 on validation error (missing token)", async () => {
    const req = createNextRequest({
      url: "/api/newsletter/unsubscribe",
      method: "POST",
      body: { email: "test@example.com" },
    });
    const res = await POSTUnsubscribe(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("VALIDATION_ERROR");
  });

  it("returns 404 when subscriber not found", async () => {
    vi.mocked(prisma.subscriber.findUnique).mockResolvedValue(null);

    const req = createNextRequest({
      url: "/api/newsletter/unsubscribe",
      method: "POST",
      body: { email: "nonexistent@example.com", token: "some-token" },
    });
    const res = await POSTUnsubscribe(req);

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.code).toBe("SUBSCRIBER_NOT_FOUND");
  });

  it("returns success when already unsubscribed", async () => {
    vi.mocked(prisma.subscriber.findUnique).mockResolvedValue({
      id: "sub-1",
      email: "test@example.com",
      status: "UNSUBSCRIBED",
    } as never);

    const req = createNextRequest({
      url: "/api/newsletter/unsubscribe",
      method: "POST",
      body: { email: "test@example.com", token: "any-token" },
    });
    const res = await POSTUnsubscribe(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toContain("already unsubscribed");
    expect(body.code).toBe("ALREADY_UNSUBSCRIBED");
  });

  it("returns 400 when HMAC token is invalid", async () => {
    vi.mocked(prisma.subscriber.findUnique).mockResolvedValue({
      id: "sub-1",
      email: "test@example.com",
      status: "ACTIVE",
    } as never);

    const req = createNextRequest({
      url: "/api/newsletter/unsubscribe",
      method: "POST",
      body: { email: "test@example.com", token: "wrong-hmac-token" },
    });
    const res = await POSTUnsubscribe(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Invalid");
    expect(body.code).toBe("INVALID_UNSUBSCRIBE_LINK");
  });

  it("unsubscribes successfully with valid HMAC token", async () => {
    // Import the real generateUnsubscribeToken to get the correct HMAC
    const { generateUnsubscribeToken } = await import("@/lib/newsletter");
    const validToken = generateUnsubscribeToken("sub-1");

    vi.mocked(prisma.subscriber.findUnique).mockResolvedValue({
      id: "sub-1",
      email: "test@example.com",
      status: "ACTIVE",
    } as never);
    vi.mocked(prisma.subscriber.update).mockResolvedValue({} as never);

    const req = createNextRequest({
      url: "/api/newsletter/unsubscribe",
      method: "POST",
      body: { email: "test@example.com", token: validToken },
    });
    const res = await POSTUnsubscribe(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toContain("unsubscribed successfully");
    expect(body.code).toBe("UNSUBSCRIBED");

    expect(prisma.subscriber.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "sub-1" },
        data: expect.objectContaining({
          status: "UNSUBSCRIBED",
        }),
      })
    );
  });
});
