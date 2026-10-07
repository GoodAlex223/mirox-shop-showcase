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
    review: {
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
import { GET as GETList } from "@/app/api/admin/reviews/route";
import { GET as GETDetail, DELETE as DELETEReview } from "@/app/api/admin/reviews/[id]/route";
import { PUT as PUTReply, DELETE as DELETEReply } from "@/app/api/admin/reviews/[id]/reply/route";
import { PUT as PUTVisibility } from "@/app/api/admin/reviews/[id]/visibility/route";

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
// GET /api/admin/reviews — List reviews
// ===========================================================================

describe("GET /api/admin/reviews", () => {
  it("returns 401 when not authenticated", async () => {
    mockAuth(null);

    const req = createNextRequest({ url: "/api/admin/reviews" });
    const res = await GETList(req);

    expect(res.status).toBe(401);
  });

  it("returns 403 when not admin", async () => {
    mockAuth(customerSession);

    const req = createNextRequest({ url: "/api/admin/reviews" });
    const res = await GETList(req);

    expect(res.status).toBe(403);
  });

  it("returns paginated reviews", async () => {
    vi.mocked(prisma.review.findMany).mockResolvedValue([
      {
        id: "r1",
        rating: 5,
        comment: "Great",
        isHidden: false,
        adminReply: null,
        adminRepliedAt: null,
        createdAt: new Date(),
        product: { id: "p1", name: "Product", slug: "product" },
        user: { id: "u1", name: "User", email: "user@test.com" },
      },
    ] as never);
    vi.mocked(prisma.review.count).mockResolvedValue(1);

    const req = createNextRequest({ url: "/api/admin/reviews" });
    const res = await GETList(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.pagination.total).toBe(1);
  });

  it("applies search filter", async () => {
    vi.mocked(prisma.review.findMany).mockResolvedValue([]);
    vi.mocked(prisma.review.count).mockResolvedValue(0);

    const req = createNextRequest({
      url: "/api/admin/reviews",
      searchParams: { search: "great" },
    });
    await GETList(req);

    expect(prisma.review.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            expect.objectContaining({
              comment: { contains: "great", mode: "insensitive" },
            }),
          ]),
        }),
      })
    );
  });

  it("applies isHidden filter", async () => {
    vi.mocked(prisma.review.findMany).mockResolvedValue([]);
    vi.mocked(prisma.review.count).mockResolvedValue(0);

    const req = createNextRequest({
      url: "/api/admin/reviews",
      searchParams: { isHidden: "true" },
    });
    await GETList(req);

    expect(prisma.review.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isHidden: true }),
      })
    );
  });

  it("applies hasReply filter", async () => {
    vi.mocked(prisma.review.findMany).mockResolvedValue([]);
    vi.mocked(prisma.review.count).mockResolvedValue(0);

    const req = createNextRequest({
      url: "/api/admin/reviews",
      searchParams: { hasReply: "true" },
    });
    await GETList(req);

    expect(prisma.review.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ adminReply: { not: null } }),
      })
    );
  });

  it("applies rating and productId filters", async () => {
    vi.mocked(prisma.review.findMany).mockResolvedValue([]);
    vi.mocked(prisma.review.count).mockResolvedValue(0);

    const req = createNextRequest({
      url: "/api/admin/reviews",
      searchParams: { rating: "4", productId: "prod-1" },
    });
    await GETList(req);

    expect(prisma.review.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ rating: 4, productId: "prod-1" }),
      })
    );
  });

  it("ignores invalid rating filter (NaN)", async () => {
    vi.mocked(prisma.review.findMany).mockResolvedValue([]);
    vi.mocked(prisma.review.count).mockResolvedValue(0);

    const req = createNextRequest({
      url: "/api/admin/reviews",
      searchParams: { rating: "abc" },
    });
    await GETList(req);

    expect(prisma.review.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.not.objectContaining({ rating: expect.anything() }),
      })
    );
  });

  it("ignores out-of-range rating filter", async () => {
    vi.mocked(prisma.review.findMany).mockResolvedValue([]);
    vi.mocked(prisma.review.count).mockResolvedValue(0);

    const req = createNextRequest({
      url: "/api/admin/reviews",
      searchParams: { rating: "0" },
    });
    await GETList(req);

    expect(prisma.review.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.not.objectContaining({ rating: expect.anything() }),
      })
    );
  });
});

// ===========================================================================
// GET /api/admin/reviews/[id] — Single review detail
// ===========================================================================

describe("GET /api/admin/reviews/[id]", () => {
  const params = createRouteParams({ id: "review-1" });

  it("returns 403 when not admin", async () => {
    mockAuth(customerSession);

    const req = createNextRequest({ url: "/api/admin/reviews/review-1" });
    const res = await GETDetail(req, params);

    expect(res.status).toBe(403);
  });

  it("returns 404 when review not found", async () => {
    vi.mocked(prisma.review.findUnique).mockResolvedValue(null);

    const req = createNextRequest({ url: "/api/admin/reviews/review-1" });
    const res = await GETDetail(req, params);

    expect(res.status).toBe(404);
  });

  it("returns review with relations", async () => {
    vi.mocked(prisma.review.findUnique).mockResolvedValue({
      id: "review-1",
      rating: 5,
      comment: "Great",
      isHidden: false,
      adminReply: null,
      adminRepliedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      product: { id: "p1", name: "Product", slug: "product" },
      user: { id: "u1", name: "User", email: "user@test.com" },
      order: { id: "o1", orderNumber: "ORD-001" },
    } as never);

    const req = createNextRequest({ url: "/api/admin/reviews/review-1" });
    const res = await GETDetail(req, params);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe("review-1");
    expect(body.product.name).toBe("Product");
    expect(body.order.orderNumber).toBe("ORD-001");
  });
});

// ===========================================================================
// DELETE /api/admin/reviews/[id]
// ===========================================================================

describe("DELETE /api/admin/reviews/[id]", () => {
  const params = createRouteParams({ id: "review-1" });

  it("returns 403 when not admin", async () => {
    mockAuth(customerSession);

    const req = createNextRequest({ url: "/api/admin/reviews/review-1", method: "DELETE" });
    const res = await DELETEReview(req, params);

    expect(res.status).toBe(403);
  });

  it("returns 404 when review not found", async () => {
    vi.mocked(prisma.review.findUnique).mockResolvedValue(null);

    const req = createNextRequest({ url: "/api/admin/reviews/review-1", method: "DELETE" });
    const res = await DELETEReview(req, params);

    expect(res.status).toBe(404);
  });

  it("deletes review successfully", async () => {
    vi.mocked(prisma.review.findUnique).mockResolvedValue({ id: "review-1" } as never);
    vi.mocked(prisma.review.delete).mockResolvedValue({} as never);

    const req = createNextRequest({ url: "/api/admin/reviews/review-1", method: "DELETE" });
    const res = await DELETEReview(req, params);

    expect(res.status).toBe(200);
    expect(prisma.review.delete).toHaveBeenCalledWith({ where: { id: "review-1" } });
  });
});

// ===========================================================================
// PUT /api/admin/reviews/[id]/reply — Add admin reply
// ===========================================================================

describe("PUT /api/admin/reviews/[id]/reply", () => {
  const params = createRouteParams({ id: "review-1" });

  it("returns 403 when not admin", async () => {
    mockAuth(customerSession);

    const req = createNextRequest({
      url: "/api/admin/reviews/review-1/reply",
      method: "PUT",
      body: { adminReply: "Thank you!" },
    });
    const res = await PUTReply(req, params);

    expect(res.status).toBe(403);
  });

  it("returns 404 when review not found", async () => {
    vi.mocked(prisma.review.findUnique).mockResolvedValue(null);

    const req = createNextRequest({
      url: "/api/admin/reviews/review-1/reply",
      method: "PUT",
      body: { adminReply: "Thank you!" },
    });
    const res = await PUTReply(req, params);

    expect(res.status).toBe(404);
  });

  it("returns 400 on validation error (empty reply)", async () => {
    vi.mocked(prisma.review.findUnique).mockResolvedValue({ id: "review-1" } as never);

    const req = createNextRequest({
      url: "/api/admin/reviews/review-1/reply",
      method: "PUT",
      body: { adminReply: "" },
    });
    const res = await PUTReply(req, params);

    expect(res.status).toBe(400);
  });

  it("returns 400 on validation error (reply too long)", async () => {
    vi.mocked(prisma.review.findUnique).mockResolvedValue({ id: "review-1" } as never);

    const req = createNextRequest({
      url: "/api/admin/reviews/review-1/reply",
      method: "PUT",
      body: { adminReply: "x".repeat(1001) },
    });
    const res = await PUTReply(req, params);

    expect(res.status).toBe(400);
  });

  it("adds admin reply successfully", async () => {
    vi.mocked(prisma.review.findUnique).mockResolvedValue({ id: "review-1" } as never);
    vi.mocked(prisma.review.update).mockResolvedValue({
      id: "review-1",
      adminReply: "Thank you for your feedback!",
      adminRepliedAt: new Date(),
    } as never);

    const req = createNextRequest({
      url: "/api/admin/reviews/review-1/reply",
      method: "PUT",
      body: { adminReply: "Thank you for your feedback!" },
    });
    const res = await PUTReply(req, params);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.adminReply).toBe("Thank you for your feedback!");
    expect(prisma.review.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "review-1" },
        data: expect.objectContaining({
          adminReply: "Thank you for your feedback!",
        }),
      })
    );
  });
});

// ===========================================================================
// DELETE /api/admin/reviews/[id]/reply — Remove admin reply
// ===========================================================================

describe("DELETE /api/admin/reviews/[id]/reply", () => {
  const params = createRouteParams({ id: "review-1" });

  it("returns 403 when not admin", async () => {
    mockAuth(customerSession);

    const req = createNextRequest({
      url: "/api/admin/reviews/review-1/reply",
      method: "DELETE",
    });
    const res = await DELETEReply(req, params);

    expect(res.status).toBe(403);
  });

  it("returns 404 when review not found", async () => {
    vi.mocked(prisma.review.findUnique).mockResolvedValue(null);

    const req = createNextRequest({
      url: "/api/admin/reviews/review-1/reply",
      method: "DELETE",
    });
    const res = await DELETEReply(req, params);

    expect(res.status).toBe(404);
  });

  it("removes admin reply successfully", async () => {
    vi.mocked(prisma.review.findUnique).mockResolvedValue({ id: "review-1" } as never);
    vi.mocked(prisma.review.update).mockResolvedValue({
      id: "review-1",
      adminReply: null,
      adminRepliedAt: null,
    } as never);

    const req = createNextRequest({
      url: "/api/admin/reviews/review-1/reply",
      method: "DELETE",
    });
    const res = await DELETEReply(req, params);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.adminReply).toBeNull();
    expect(prisma.review.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { adminReply: null, adminRepliedAt: null },
      })
    );
  });
});

// ===========================================================================
// PUT /api/admin/reviews/[id]/visibility — Toggle visibility
// ===========================================================================

describe("PUT /api/admin/reviews/[id]/visibility", () => {
  const params = createRouteParams({ id: "review-1" });

  it("returns 403 when not admin", async () => {
    mockAuth(customerSession);

    const req = createNextRequest({
      url: "/api/admin/reviews/review-1/visibility",
      method: "PUT",
      body: { isHidden: true },
    });
    const res = await PUTVisibility(req, params);

    expect(res.status).toBe(403);
  });

  it("returns 404 when review not found", async () => {
    vi.mocked(prisma.review.findUnique).mockResolvedValue(null);

    const req = createNextRequest({
      url: "/api/admin/reviews/review-1/visibility",
      method: "PUT",
      body: { isHidden: true },
    });
    const res = await PUTVisibility(req, params);

    expect(res.status).toBe(404);
  });

  it("returns 400 on validation error (non-boolean)", async () => {
    vi.mocked(prisma.review.findUnique).mockResolvedValue({ id: "review-1" } as never);

    const req = createNextRequest({
      url: "/api/admin/reviews/review-1/visibility",
      method: "PUT",
      body: { isHidden: "yes" },
    });
    const res = await PUTVisibility(req, params);

    expect(res.status).toBe(400);
  });

  it("hides review successfully", async () => {
    vi.mocked(prisma.review.findUnique).mockResolvedValue({ id: "review-1" } as never);
    vi.mocked(prisma.review.update).mockResolvedValue({
      id: "review-1",
      isHidden: true,
    } as never);

    const req = createNextRequest({
      url: "/api/admin/reviews/review-1/visibility",
      method: "PUT",
      body: { isHidden: true },
    });
    const res = await PUTVisibility(req, params);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.isHidden).toBe(true);
  });

  it("shows review successfully", async () => {
    vi.mocked(prisma.review.findUnique).mockResolvedValue({ id: "review-1" } as never);
    vi.mocked(prisma.review.update).mockResolvedValue({
      id: "review-1",
      isHidden: false,
    } as never);

    const req = createNextRequest({
      url: "/api/admin/reviews/review-1/visibility",
      method: "PUT",
      body: { isHidden: false },
    });
    const res = await PUTVisibility(req, params);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.isHidden).toBe(false);
  });
});
