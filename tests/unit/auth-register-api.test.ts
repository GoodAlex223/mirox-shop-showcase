import { describe, it, expect, vi, beforeEach } from "vitest";
import { createNextRequest } from "../helpers/api-test-utils";

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock("bcryptjs", () => ({
  default: { hash: vi.fn().mockResolvedValue("hashed-password") },
}));

import { prisma } from "@/lib/db";
import { POST } from "@/app/api/auth/register/route";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/auth/register", () => {
  it("returns 409 with EMAIL_EXISTS code for a duplicate email", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "u1" } as never);

    const req = createNextRequest({
      url: "/api/auth/register",
      method: "POST",
      body: {
        name: "Тест",
        email: "dup@example.com",
        password: "password123",
        confirmPassword: "password123",
      },
    });
    const res = await POST(req);

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe("EMAIL_EXISTS");
  });

  it("creates the user and returns 201 for a new email", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.user.create).mockResolvedValue({
      id: "u2",
      name: "Тест",
      email: "new@example.com",
      role: "CUSTOMER",
      createdAt: new Date(),
    } as never);

    const req = createNextRequest({
      url: "/api/auth/register",
      method: "POST",
      body: {
        name: "Тест",
        email: "new@example.com",
        password: "password123",
        confirmPassword: "password123",
      },
    });
    const res = await POST(req);

    expect(res.status).toBe(201);
  });
});
