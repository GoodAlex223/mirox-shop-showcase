import { describe, it, expect, vi, beforeEach } from "vitest";
import { createNextRequest, createRouteParams } from "../helpers/api-test-utils";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    subscriber: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
  },
}));

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { GET as GETList } from "@/app/api/admin/newsletter/route";
import {
  PATCH as PATCHSubscriber,
  DELETE as DELETESubscriber,
} from "@/app/api/admin/newsletter/[id]/route";
import { GET as GETExport } from "@/app/api/admin/newsletter/export/route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const adminSession = {
  user: { id: "admin-1", email: "admin@test.com", role: "ADMIN" },
  expires: "",
};

const customerSession = {
  user: { id: "user-1", email: "customer@test.com", role: "CUSTOMER" },
  expires: "",
};

function mockAuth(session: unknown = adminSession) {
  vi.mocked(auth).mockResolvedValue(session as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth();
});

// ===========================================================================
// GET /api/admin/newsletter — List subscribers
// ===========================================================================

describe("GET /api/admin/newsletter", () => {
  it("returns 401 when not authenticated", async () => {
    mockAuth(null);

    const req = createNextRequest({ url: "/api/admin/newsletter" });
    const res = await GETList(req);

    expect(res.status).toBe(401);
  });

  it("returns 403 when not admin", async () => {
    mockAuth(customerSession);

    const req = createNextRequest({ url: "/api/admin/newsletter" });
    const res = await GETList(req);

    expect(res.status).toBe(403);
  });

  it("returns paginated subscribers", async () => {
    vi.mocked(prisma.subscriber.findMany).mockResolvedValue([
      {
        id: "sub-1",
        email: "test@example.com",
        status: "ACTIVE",
        subscribedAt: new Date(),
        unsubscribedAt: null,
        createdAt: new Date(),
      },
    ] as never);
    vi.mocked(prisma.subscriber.count).mockResolvedValue(1);

    const req = createNextRequest({ url: "/api/admin/newsletter" });
    const res = await GETList(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.pagination.total).toBe(1);
  });

  it("applies email search filter", async () => {
    vi.mocked(prisma.subscriber.findMany).mockResolvedValue([]);
    vi.mocked(prisma.subscriber.count).mockResolvedValue(0);

    const req = createNextRequest({
      url: "/api/admin/newsletter",
      searchParams: { search: "test" },
    });
    await GETList(req);

    expect(prisma.subscriber.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          email: { contains: "test", mode: "insensitive" },
        }),
      })
    );
  });

  it("applies status filter", async () => {
    vi.mocked(prisma.subscriber.findMany).mockResolvedValue([]);
    vi.mocked(prisma.subscriber.count).mockResolvedValue(0);

    const req = createNextRequest({
      url: "/api/admin/newsletter",
      searchParams: { status: "ACTIVE" },
    });
    await GETList(req);

    expect(prisma.subscriber.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "ACTIVE" }),
      })
    );
  });

  it("ignores 'all' status filter", async () => {
    vi.mocked(prisma.subscriber.findMany).mockResolvedValue([]);
    vi.mocked(prisma.subscriber.count).mockResolvedValue(0);

    const req = createNextRequest({
      url: "/api/admin/newsletter",
      searchParams: { status: "all" },
    });
    await GETList(req);

    expect(prisma.subscriber.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.not.objectContaining({ status: expect.anything() }),
      })
    );
  });

  it("respects pagination params", async () => {
    vi.mocked(prisma.subscriber.findMany).mockResolvedValue([]);
    vi.mocked(prisma.subscriber.count).mockResolvedValue(100);

    const req = createNextRequest({
      url: "/api/admin/newsletter",
      searchParams: { page: "2", limit: "10" },
    });
    const res = await GETList(req);

    const body = await res.json();
    expect(body.pagination.page).toBe(2);
    expect(body.pagination.limit).toBe(10);
    expect(prisma.subscriber.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 10, take: 10 })
    );
  });
});

// ===========================================================================
// PATCH /api/admin/newsletter/[id] — Update subscriber status
// ===========================================================================

describe("PATCH /api/admin/newsletter/[id]", () => {
  const params = createRouteParams({ id: "sub-1" });

  it("returns 403 when not admin", async () => {
    mockAuth(customerSession);

    const req = createNextRequest({
      url: "/api/admin/newsletter/sub-1",
      method: "PATCH",
      body: { status: "ACTIVE" },
    });
    const res = await PATCHSubscriber(req, params);

    expect(res.status).toBe(403);
  });

  it("returns 404 when subscriber not found", async () => {
    vi.mocked(prisma.subscriber.findUnique).mockResolvedValue(null);

    const req = createNextRequest({
      url: "/api/admin/newsletter/sub-1",
      method: "PATCH",
      body: { status: "ACTIVE" },
    });
    const res = await PATCHSubscriber(req, params);

    expect(res.status).toBe(404);
  });

  it("returns 400 on validation error (invalid status)", async () => {
    vi.mocked(prisma.subscriber.findUnique).mockResolvedValue({
      id: "sub-1",
      status: "PENDING",
    } as never);

    const req = createNextRequest({
      url: "/api/admin/newsletter/sub-1",
      method: "PATCH",
      body: { status: "INVALID" },
    });
    const res = await PATCHSubscriber(req, params);

    expect(res.status).toBe(400);
  });

  it("activates subscriber (sets subscribedAt, clears tokens)", async () => {
    vi.mocked(prisma.subscriber.findUnique).mockResolvedValue({
      id: "sub-1",
      status: "PENDING",
    } as never);
    vi.mocked(prisma.subscriber.update).mockResolvedValue({
      id: "sub-1",
      email: "test@example.com",
      status: "ACTIVE",
      subscribedAt: new Date(),
      unsubscribedAt: null,
      createdAt: new Date(),
    } as never);

    const req = createNextRequest({
      url: "/api/admin/newsletter/sub-1",
      method: "PATCH",
      body: { status: "ACTIVE" },
    });
    const res = await PATCHSubscriber(req, params);

    expect(res.status).toBe(200);
    expect(prisma.subscriber.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "ACTIVE",
          subscribedAt: expect.any(Date),
          unsubscribedAt: null,
          confirmationToken: null,
          confirmationExpiry: null,
        }),
      })
    );
  });

  it("unsubscribes subscriber (sets unsubscribedAt)", async () => {
    vi.mocked(prisma.subscriber.findUnique).mockResolvedValue({
      id: "sub-1",
      status: "ACTIVE",
    } as never);
    vi.mocked(prisma.subscriber.update).mockResolvedValue({
      id: "sub-1",
      email: "test@example.com",
      status: "UNSUBSCRIBED",
      subscribedAt: new Date(),
      unsubscribedAt: new Date(),
      createdAt: new Date(),
    } as never);

    const req = createNextRequest({
      url: "/api/admin/newsletter/sub-1",
      method: "PATCH",
      body: { status: "UNSUBSCRIBED" },
    });
    const res = await PATCHSubscriber(req, params);

    expect(res.status).toBe(200);
    expect(prisma.subscriber.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "UNSUBSCRIBED",
          unsubscribedAt: expect.any(Date),
        }),
      })
    );
  });

  it("does not update timestamps when status unchanged", async () => {
    vi.mocked(prisma.subscriber.findUnique).mockResolvedValue({
      id: "sub-1",
      status: "ACTIVE",
    } as never);
    vi.mocked(prisma.subscriber.update).mockResolvedValue({
      id: "sub-1",
      email: "test@example.com",
      status: "ACTIVE",
      subscribedAt: new Date(),
      unsubscribedAt: null,
      createdAt: new Date(),
    } as never);

    const req = createNextRequest({
      url: "/api/admin/newsletter/sub-1",
      method: "PATCH",
      body: { status: "ACTIVE" },
    });
    await PATCHSubscriber(req, params);

    // When status is already ACTIVE, the condition `status !== "ACTIVE"` is false
    // So subscribedAt should NOT be in the update data
    const updateCall = vi.mocked(prisma.subscriber.update).mock.calls[0][0];
    expect(updateCall.data).toEqual({ status: "ACTIVE" });
  });
});

// ===========================================================================
// DELETE /api/admin/newsletter/[id] — Delete subscriber
// ===========================================================================

describe("DELETE /api/admin/newsletter/[id]", () => {
  const params = createRouteParams({ id: "sub-1" });

  it("returns 403 when not admin", async () => {
    mockAuth(customerSession);

    const req = createNextRequest({ url: "/api/admin/newsletter/sub-1", method: "DELETE" });
    const res = await DELETESubscriber(req, params);

    expect(res.status).toBe(403);
  });

  it("returns 404 when subscriber not found", async () => {
    vi.mocked(prisma.subscriber.findUnique).mockResolvedValue(null);

    const req = createNextRequest({ url: "/api/admin/newsletter/sub-1", method: "DELETE" });
    const res = await DELETESubscriber(req, params);

    expect(res.status).toBe(404);
  });

  it("deletes subscriber successfully", async () => {
    vi.mocked(prisma.subscriber.findUnique).mockResolvedValue({ id: "sub-1" } as never);
    vi.mocked(prisma.subscriber.delete).mockResolvedValue({} as never);

    const req = createNextRequest({ url: "/api/admin/newsletter/sub-1", method: "DELETE" });
    const res = await DELETESubscriber(req, params);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toContain("deleted");
    expect(prisma.subscriber.delete).toHaveBeenCalledWith({ where: { id: "sub-1" } });
  });
});

// ===========================================================================
// GET /api/admin/newsletter/export — CSV export
// ===========================================================================

describe("GET /api/admin/newsletter/export", () => {
  it("returns 403 when not admin", async () => {
    mockAuth(customerSession);

    const req = createNextRequest({ url: "/api/admin/newsletter/export" });
    const res = await GETExport(req);

    expect(res.status).toBe(403);
  });

  it("returns CSV with headers and data", async () => {
    vi.mocked(prisma.subscriber.findMany).mockResolvedValue([
      {
        email: "test@example.com",
        status: "ACTIVE",
        subscribedAt: new Date("2025-01-15T10:00:00Z"),
        createdAt: new Date("2025-01-15T10:00:00Z"),
      },
    ] as never);

    const req = createNextRequest({ url: "/api/admin/newsletter/export" });
    const res = await GETExport(req);

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/csv");
    expect(res.headers.get("Content-Disposition")).toContain("attachment");
    expect(res.headers.get("Content-Disposition")).toContain(".csv");

    const csv = await res.text();
    // Header cells are quoted since G17 F4 moved both exports onto the shared
    // toCsv() sink, which escapes every cell rather than only the data rows.
    // Still valid CSV and identical in a spreadsheet; the previous unquoted
    // header row was the inconsistent side.
    expect(csv).toContain('"Email","Status","Subscribed At","Created At"');
    expect(csv).toContain("test@example.com");
    expect(csv).toContain("ACTIVE");
  });

  it("escapes formula injection characters in emails", async () => {
    vi.mocked(prisma.subscriber.findMany).mockResolvedValue([
      {
        email: "=1+1@example.com",
        status: "ACTIVE",
        subscribedAt: new Date("2025-01-15T10:00:00Z"),
        createdAt: new Date("2025-01-15T10:00:00Z"),
      },
      {
        email: "+dangerous@example.com",
        status: "ACTIVE",
        subscribedAt: null,
        createdAt: new Date("2025-01-15T10:00:00Z"),
      },
    ] as never);

    const req = createNextRequest({ url: "/api/admin/newsletter/export" });
    const res = await GETExport(req);

    const csv = await res.text();
    // Formula characters should be prefixed with single quote
    expect(csv).toContain("'=1+1@example.com");
    expect(csv).toContain("'+dangerous@example.com");
  });

  it("filters by status when provided", async () => {
    vi.mocked(prisma.subscriber.findMany).mockResolvedValue([]);

    const req = createNextRequest({
      url: "/api/admin/newsletter/export",
      searchParams: { status: "ACTIVE" },
    });
    await GETExport(req);

    expect(prisma.subscriber.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "ACTIVE" }),
      })
    );
  });

  it("exports all subscribers when status is 'all'", async () => {
    vi.mocked(prisma.subscriber.findMany).mockResolvedValue([]);

    const req = createNextRequest({
      url: "/api/admin/newsletter/export",
      searchParams: { status: "all" },
    });
    await GETExport(req);

    expect(prisma.subscriber.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {},
      })
    );
  });

  it("handles empty subscribedAt field", async () => {
    vi.mocked(prisma.subscriber.findMany).mockResolvedValue([
      {
        email: "pending@example.com",
        status: "PENDING",
        subscribedAt: null,
        createdAt: new Date("2025-01-15T10:00:00Z"),
      },
    ] as never);

    const req = createNextRequest({ url: "/api/admin/newsletter/export" });
    const res = await GETExport(req);

    const csv = await res.text();
    // When subscribedAt is null, it should output empty string
    const lines = csv.split("\n");
    expect(lines[1]).toContain('""');
  });
});
