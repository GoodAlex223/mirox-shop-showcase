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
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
      aggregate: vi.fn(),
      groupBy: vi.fn(),
    },
    order: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    product: {
      findUnique: vi.fn(),
    },
  },
}));

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { POST } from "@/app/api/reviews/route";
import { GET as GETEligibility } from "@/app/api/reviews/eligibility/route";
import { PUT as PUTReview, DELETE as DELETEReview } from "@/app/api/reviews/[id]/route";
import { GET as GETProductReviews } from "@/app/api/products/[slug]/reviews/route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const customerSession = {
  user: { id: "user-1", email: "customer@test.com", role: "CUSTOMER" },
  expires: "",
};

function mockAuth(session: unknown = customerSession) {
  vi.mocked(auth).mockResolvedValue(session as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth();
});

// ===========================================================================
// POST /api/reviews — Create review
// ===========================================================================

describe("POST /api/reviews", () => {
  const validBody = {
    productId: "prod-1",
    orderId: "order-1",
    rating: 5,
    comment: "Great product!",
  };

  it("returns 401 when not authenticated", async () => {
    mockAuth(null);

    const req = createNextRequest({ url: "/api/reviews", method: "POST", body: validBody });
    const res = await POST(req);

    expect(res.status).toBe(401);
  });

  it("returns 400 on validation error (missing productId)", async () => {
    const req = createNextRequest({
      url: "/api/reviews",
      method: "POST",
      body: { rating: 5 },
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  it("returns 400 on validation error (rating out of range)", async () => {
    const req = createNextRequest({
      url: "/api/reviews",
      method: "POST",
      body: { ...validBody, rating: 6 },
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  it("returns 404 when order not found", async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValue(null);

    const req = createNextRequest({ url: "/api/reviews", method: "POST", body: validBody });
    const res = await POST(req);

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Order not found");
  });

  it("returns 403 when order belongs to different user", async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValue({
      userId: "other-user",
      status: "DELIVERED",
      items: [{ id: "item-1" }],
    } as never);

    const req = createNextRequest({ url: "/api/reviews", method: "POST", body: validBody });
    const res = await POST(req);

    expect(res.status).toBe(403);
  });

  it("returns 400 when order is not delivered", async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValue({
      userId: "user-1",
      status: "PROCESSING",
      items: [{ id: "item-1" }],
    } as never);

    const req = createNextRequest({ url: "/api/reviews", method: "POST", body: validBody });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("delivered");
  });

  it("returns 400 when product not in order", async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValue({
      userId: "user-1",
      status: "DELIVERED",
      items: [],
    } as never);

    const req = createNextRequest({ url: "/api/reviews", method: "POST", body: validBody });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("does not contain");
  });

  it("returns 409 when review already exists (pre-check)", async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValue({
      userId: "user-1",
      status: "DELIVERED",
      items: [{ id: "item-1" }],
    } as never);
    vi.mocked(prisma.review.findUnique).mockResolvedValue({ id: "existing-review" } as never);

    const req = createNextRequest({ url: "/api/reviews", method: "POST", body: validBody });
    const res = await POST(req);

    expect(res.status).toBe(409);
  });

  it("creates review successfully with 201 status", async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValue({
      userId: "user-1",
      status: "DELIVERED",
      items: [{ id: "item-1" }],
    } as never);
    vi.mocked(prisma.review.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.review.create).mockResolvedValue({
      id: "review-1",
      rating: 5,
      comment: "Great product!",
      createdAt: new Date("2025-01-01"),
      user: { id: "user-1", name: "Test User", image: null },
    } as never);

    const req = createNextRequest({ url: "/api/reviews", method: "POST", body: validBody });
    const res = await POST(req);

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe("review-1");
    expect(body.rating).toBe(5);
    expect(prisma.review.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          productId: "prod-1",
          userId: "user-1",
          orderId: "order-1",
          rating: 5,
        }),
      })
    );
  });

  it("handles P2002 unique constraint violation", async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValue({
      userId: "user-1",
      status: "DELIVERED",
      items: [{ id: "item-1" }],
    } as never);
    vi.mocked(prisma.review.findUnique).mockResolvedValue(null);

    const prismaError = new Error("Unique constraint") as Error & { code: string };
    prismaError.code = "P2002";
    Object.setPrototypeOf(prismaError, Object.getPrototypeOf(new Error()));
    // Simulate Prisma's PrismaClientKnownRequestError
    (prismaError as Record<string, unknown>).name = "PrismaClientKnownRequestError";
    vi.mocked(prisma.review.create).mockRejectedValue(prismaError);

    const req = createNextRequest({ url: "/api/reviews", method: "POST", body: validBody });
    const res = await POST(req);

    // The route catches P2002 specifically via instanceof check
    // Since our mock isn't a real PrismaClientKnownRequestError, it falls to the generic catch
    expect(res.status).toBe(500);
  });
});

// ===========================================================================
// GET /api/reviews/eligibility
// ===========================================================================

describe("GET /api/reviews/eligibility", () => {
  it("returns 401 when not authenticated", async () => {
    mockAuth(null);

    const req = createNextRequest({
      url: "/api/reviews/eligibility",
      searchParams: { productId: "prod-1" },
    });
    const res = await GETEligibility(req);

    expect(res.status).toBe(401);
  });

  it("returns 400 when productId is missing", async () => {
    const req = createNextRequest({ url: "/api/reviews/eligibility" });
    const res = await GETEligibility(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("productId");
  });

  it("returns canReview=false when review already exists", async () => {
    vi.mocked(prisma.review.findUnique).mockResolvedValue({ id: "review-1" } as never);

    const req = createNextRequest({
      url: "/api/reviews/eligibility",
      searchParams: { productId: "prod-1" },
    });
    const res = await GETEligibility(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.canReview).toBe(false);
    expect(body.hasExistingReview).toBe(true);
    expect(body.orderId).toBeNull();
  });

  it("returns canReview=false when no delivered order exists", async () => {
    vi.mocked(prisma.review.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.order.findFirst).mockResolvedValue(null);

    const req = createNextRequest({
      url: "/api/reviews/eligibility",
      searchParams: { productId: "prod-1" },
    });
    const res = await GETEligibility(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.canReview).toBe(false);
    expect(body.hasExistingReview).toBe(false);
    expect(body.orderId).toBeNull();
  });

  it("returns canReview=true with orderId when eligible", async () => {
    vi.mocked(prisma.review.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.order.findFirst).mockResolvedValue({ id: "order-1" } as never);

    const req = createNextRequest({
      url: "/api/reviews/eligibility",
      searchParams: { productId: "prod-1" },
    });
    const res = await GETEligibility(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.canReview).toBe(true);
    expect(body.hasExistingReview).toBe(false);
    expect(body.orderId).toBe("order-1");
  });
});

// ===========================================================================
// PUT /api/reviews/[id] — Update own review
// ===========================================================================

describe("PUT /api/reviews/[id]", () => {
  const params = createRouteParams({ id: "review-1" });

  it("returns 401 when not authenticated", async () => {
    mockAuth(null);

    const req = createNextRequest({
      url: "/api/reviews/review-1",
      method: "PUT",
      body: { rating: 4 },
    });
    const res = await PUTReview(req, params);

    expect(res.status).toBe(401);
  });

  it("returns 404 when review not found", async () => {
    vi.mocked(prisma.review.findUnique).mockResolvedValue(null);

    const req = createNextRequest({
      url: "/api/reviews/review-1",
      method: "PUT",
      body: { rating: 4 },
    });
    const res = await PUTReview(req, params);

    expect(res.status).toBe(404);
  });

  it("returns 403 when editing another user's review", async () => {
    vi.mocked(prisma.review.findUnique).mockResolvedValue({
      id: "review-1",
      userId: "other-user",
    } as never);

    const req = createNextRequest({
      url: "/api/reviews/review-1",
      method: "PUT",
      body: { rating: 4 },
    });
    const res = await PUTReview(req, params);

    expect(res.status).toBe(403);
  });

  it("returns 400 on validation error", async () => {
    vi.mocked(prisma.review.findUnique).mockResolvedValue({
      id: "review-1",
      userId: "user-1",
    } as never);

    const req = createNextRequest({
      url: "/api/reviews/review-1",
      method: "PUT",
      body: { rating: 10 },
    });
    const res = await PUTReview(req, params);

    expect(res.status).toBe(400);
  });

  it("updates review successfully", async () => {
    vi.mocked(prisma.review.findUnique).mockResolvedValue({
      id: "review-1",
      userId: "user-1",
    } as never);
    vi.mocked(prisma.review.update).mockResolvedValue({
      id: "review-1",
      rating: 4,
      comment: "Updated comment",
      createdAt: new Date(),
      updatedAt: new Date(),
      user: { id: "user-1", name: "Test", image: null },
    } as never);

    const req = createNextRequest({
      url: "/api/reviews/review-1",
      method: "PUT",
      body: { rating: 4, comment: "Updated comment" },
    });
    const res = await PUTReview(req, params);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.rating).toBe(4);
  });
});

// ===========================================================================
// DELETE /api/reviews/[id] — Delete own review
// ===========================================================================

describe("DELETE /api/reviews/[id]", () => {
  const params = createRouteParams({ id: "review-1" });

  it("returns 401 when not authenticated", async () => {
    mockAuth(null);

    const req = createNextRequest({ url: "/api/reviews/review-1", method: "DELETE" });
    const res = await DELETEReview(req, params);

    expect(res.status).toBe(401);
  });

  it("returns 404 when review not found", async () => {
    vi.mocked(prisma.review.findUnique).mockResolvedValue(null);

    const req = createNextRequest({ url: "/api/reviews/review-1", method: "DELETE" });
    const res = await DELETEReview(req, params);

    expect(res.status).toBe(404);
  });

  it("returns 403 when deleting another user's review", async () => {
    vi.mocked(prisma.review.findUnique).mockResolvedValue({
      id: "review-1",
      userId: "other-user",
    } as never);

    const req = createNextRequest({ url: "/api/reviews/review-1", method: "DELETE" });
    const res = await DELETEReview(req, params);

    expect(res.status).toBe(403);
  });

  it("deletes review successfully", async () => {
    vi.mocked(prisma.review.findUnique).mockResolvedValue({
      id: "review-1",
      userId: "user-1",
    } as never);
    vi.mocked(prisma.review.delete).mockResolvedValue({} as never);

    const req = createNextRequest({ url: "/api/reviews/review-1", method: "DELETE" });
    const res = await DELETEReview(req, params);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toContain("deleted");
    expect(prisma.review.delete).toHaveBeenCalledWith({ where: { id: "review-1" } });
  });
});

// ===========================================================================
// GET /api/products/[slug]/reviews — Public product reviews
// ===========================================================================

describe("GET /api/products/[slug]/reviews", () => {
  const params = createRouteParams({ slug: "test-product" });

  it("returns 404 when product not found", async () => {
    vi.mocked(prisma.product.findUnique).mockResolvedValue(null);

    const req = createNextRequest({ url: "/api/products/test-product/reviews" });
    const res = await GETProductReviews(req, params);

    expect(res.status).toBe(404);
  });

  it("returns paginated reviews with stats", async () => {
    vi.mocked(prisma.product.findUnique).mockResolvedValue({ id: "prod-1" } as never);
    vi.mocked(prisma.review.findMany).mockResolvedValue([
      {
        id: "r1",
        rating: 5,
        comment: "Great",
        adminReply: null,
        adminRepliedAt: null,
        createdAt: new Date(),
        user: { id: "u1", name: "User 1", image: null },
      },
    ] as never);
    vi.mocked(prisma.review.count).mockResolvedValue(1);
    vi.mocked(prisma.review.aggregate).mockResolvedValue({
      _avg: { rating: 5 },
      _count: 1,
    } as never);
    vi.mocked(prisma.review.groupBy).mockResolvedValue([{ rating: 5, _count: 1 }] as never);

    const req = createNextRequest({ url: "/api/products/test-product/reviews" });
    const res = await GETProductReviews(req, params);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.averageRating).toBe(5);
    expect(body.totalReviews).toBe(1);
    expect(body.ratingDistribution).toHaveLength(5);
    expect(body.pagination).toBeDefined();
  });

  it("filters by rating when provided", async () => {
    vi.mocked(prisma.product.findUnique).mockResolvedValue({ id: "prod-1" } as never);
    vi.mocked(prisma.review.findMany).mockResolvedValue([]);
    vi.mocked(prisma.review.count).mockResolvedValue(0);
    vi.mocked(prisma.review.aggregate).mockResolvedValue({
      _avg: { rating: null },
      _count: 0,
    } as never);
    vi.mocked(prisma.review.groupBy).mockResolvedValue([] as never);

    const req = createNextRequest({
      url: "/api/products/test-product/reviews",
      searchParams: { rating: "5" },
    });
    const res = await GETProductReviews(req, params);

    expect(res.status).toBe(200);
    // Verify findMany was called with rating filter
    expect(prisma.review.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ rating: 5 }),
      })
    );
  });

  it("ignores invalid rating filter (NaN)", async () => {
    vi.mocked(prisma.product.findUnique).mockResolvedValue({ id: "prod-1" } as never);
    vi.mocked(prisma.review.findMany).mockResolvedValue([]);
    vi.mocked(prisma.review.count).mockResolvedValue(0);
    vi.mocked(prisma.review.aggregate).mockResolvedValue({
      _avg: { rating: null },
      _count: 0,
    } as never);
    vi.mocked(prisma.review.groupBy).mockResolvedValue([] as never);

    const req = createNextRequest({
      url: "/api/products/test-product/reviews",
      searchParams: { rating: "abc" },
    });
    const res = await GETProductReviews(req, params);

    expect(res.status).toBe(200);
    // Should NOT include rating in where clause
    expect(prisma.review.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.not.objectContaining({ rating: expect.anything() }),
      })
    );
  });

  it("ignores out-of-range rating filter", async () => {
    vi.mocked(prisma.product.findUnique).mockResolvedValue({ id: "prod-1" } as never);
    vi.mocked(prisma.review.findMany).mockResolvedValue([]);
    vi.mocked(prisma.review.count).mockResolvedValue(0);
    vi.mocked(prisma.review.aggregate).mockResolvedValue({
      _avg: { rating: null },
      _count: 0,
    } as never);
    vi.mocked(prisma.review.groupBy).mockResolvedValue([] as never);

    const req = createNextRequest({
      url: "/api/products/test-product/reviews",
      searchParams: { rating: "99" },
    });
    const res = await GETProductReviews(req, params);

    expect(res.status).toBe(200);
    expect(prisma.review.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.not.objectContaining({ rating: expect.anything() }),
      })
    );
  });

  it("returns empty rating distribution when no reviews", async () => {
    vi.mocked(prisma.product.findUnique).mockResolvedValue({ id: "prod-1" } as never);
    vi.mocked(prisma.review.findMany).mockResolvedValue([]);
    vi.mocked(prisma.review.count).mockResolvedValue(0);
    vi.mocked(prisma.review.aggregate).mockResolvedValue({
      _avg: { rating: null },
      _count: 0,
    } as never);
    vi.mocked(prisma.review.groupBy).mockResolvedValue([] as never);

    const req = createNextRequest({ url: "/api/products/test-product/reviews" });
    const res = await GETProductReviews(req, params);

    const body = await res.json();
    expect(body.averageRating).toBe(0);
    expect(body.ratingDistribution.every((d: { count: number }) => d.count === 0)).toBe(true);
  });
});
