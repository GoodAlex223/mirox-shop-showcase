import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

import { auth } from "@/lib/auth";
import {
  requireAdmin,
  requireAuth,
  apiError,
  apiSuccess,
  getPagination,
  paginatedResponse,
} from "@/lib/api-utils";

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Auth guards
// ---------------------------------------------------------------------------

describe("requireAdmin", () => {
  it("returns 401 error when no session", async () => {
    vi.mocked(auth).mockResolvedValue(null);

    const result = await requireAdmin();

    expect(result.session).toBeNull();
    expect(result.error).not.toBeNull();

    const body = await result.error!.json();
    expect(result.error!.status).toBe(401);
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 403 error when user is not admin", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "user1", email: "user@test.com", role: "CUSTOMER" },
      expires: "",
    } as never);

    const result = await requireAdmin();

    expect(result.session).toBeNull();
    expect(result.error).not.toBeNull();

    const body = await result.error!.json();
    expect(result.error!.status).toBe(403);
    expect(body.error).toBe("Forbidden");
  });

  it("returns session when user is admin", async () => {
    const session = {
      user: { id: "admin1", email: "admin@test.com", role: "ADMIN" },
      expires: "",
    };
    vi.mocked(auth).mockResolvedValue(session as never);

    const result = await requireAdmin();

    expect(result.error).toBeNull();
    expect(result.session).toBe(session);
  });
});

describe("requireAuth", () => {
  it("returns 401 error when no session", async () => {
    vi.mocked(auth).mockResolvedValue(null);

    const result = await requireAuth();

    expect(result.session).toBeNull();
    const body = await result.error!.json();
    expect(result.error!.status).toBe(401);
    expect(body.error).toBe("Unauthorized");
  });

  it("returns session when authenticated", async () => {
    const session = {
      user: { id: "user1", email: "user@test.com", role: "CUSTOMER" },
      expires: "",
    };
    vi.mocked(auth).mockResolvedValue(session as never);

    const result = await requireAuth();

    expect(result.error).toBeNull();
    expect(result.session).toBe(session);
  });
});

// ---------------------------------------------------------------------------
// Response helpers
// ---------------------------------------------------------------------------

describe("apiError", () => {
  it("returns JSON response with error message and status", async () => {
    const response = apiError("Something went wrong", 422);

    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body).toEqual({ error: "Something went wrong" });
  });

  it("defaults to 400 status", async () => {
    const response = apiError("Bad request");
    expect(response.status).toBe(400);
  });

  it("includes a machine code when provided", async () => {
    const response = apiError("Invalid confirmation link", 404, "INVALID_TOKEN");

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body).toEqual({ error: "Invalid confirmation link", code: "INVALID_TOKEN" });
  });

  it("omits the code key entirely when not provided", async () => {
    const response = apiError("Plain");
    const body = await response.json();

    expect(body).toEqual({ error: "Plain" });
    expect("code" in body).toBe(false);
  });
});

describe("apiSuccess", () => {
  it("returns JSON response with data and status", async () => {
    const response = apiSuccess({ items: [1, 2, 3] }, 201);

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body).toEqual({ items: [1, 2, 3] });
  });

  it("defaults to 200 status", async () => {
    const response = apiSuccess({ ok: true });
    expect(response.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

describe("getPagination", () => {
  it("defaults to page 1, limit 20", () => {
    const params = new URLSearchParams();
    const result = getPagination(params);

    expect(result).toEqual({ page: 1, limit: 20, skip: 0 });
  });

  it("parses valid page and limit", () => {
    const params = new URLSearchParams({ page: "3", limit: "50" });
    const result = getPagination(params);

    expect(result).toEqual({ page: 3, limit: 50, skip: 100 });
  });

  it("clamps limit to max 100", () => {
    const params = new URLSearchParams({ limit: "999" });
    const result = getPagination(params);

    expect(result.limit).toBe(100);
  });

  it("enforces minimum page 1", () => {
    const params = new URLSearchParams({ page: "0" });
    const result = getPagination(params);

    expect(result.page).toBe(1);
    expect(result.skip).toBe(0);
  });

  it("enforces minimum limit 1", () => {
    const params = new URLSearchParams({ limit: "0" });
    const result = getPagination(params);

    expect(result.limit).toBe(1);
  });

  // BUG: parseInt("abc") = NaN, Math.max(1, NaN) = NaN — should default to safe values.
  // Fix tracked in BACKLOG: getPagination() should use `parseInt(x, 10) || 1`.
  it.todo("should default NaN to safe values when given non-numeric input");
});

describe("paginatedResponse", () => {
  it("returns correct pagination metadata", () => {
    const data = [{ id: "1" }, { id: "2" }];
    const result = paginatedResponse(data, 50, { page: 1, limit: 20, skip: 0 });

    expect(result.data).toEqual(data);
    expect(result.pagination).toEqual({
      page: 1,
      limit: 20,
      total: 50,
      totalPages: 3,
      hasNext: true,
      hasPrev: false,
    });
  });

  it("calculates hasNext=false on last page", () => {
    const result = paginatedResponse([], 50, { page: 3, limit: 20, skip: 40 });

    expect(result.pagination.hasNext).toBe(false);
    expect(result.pagination.hasPrev).toBe(true);
  });

  it("handles empty data", () => {
    const result = paginatedResponse([], 0, { page: 1, limit: 20, skip: 0 });

    expect(result.pagination.totalPages).toBe(0);
    expect(result.pagination.hasNext).toBe(false);
    expect(result.pagination.hasPrev).toBe(false);
  });

  it("handles single page", () => {
    const result = paginatedResponse([{ id: "1" }], 1, { page: 1, limit: 20, skip: 0 });

    expect(result.pagination.totalPages).toBe(1);
    expect(result.pagination.hasNext).toBe(false);
    expect(result.pagination.hasPrev).toBe(false);
  });
});
