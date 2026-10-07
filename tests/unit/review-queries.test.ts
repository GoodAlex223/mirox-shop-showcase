import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: { review: { findMany: vi.fn() } },
}));

import { prisma } from "@/lib/db";
import { getTestimonials } from "@/lib/review-queries";

const findMany = prisma.review.findMany as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => vi.clearAllMocks());

describe("getTestimonials", () => {
  it("selects only visible, high-rated reviews that have a comment", async () => {
    findMany.mockResolvedValue([]);

    await getTestimonials(6);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isHidden: false,
          rating: { gte: 4 },
          comment: { not: null },
        }),
        orderBy: { createdAt: "desc" },
        take: 6,
      })
    );
  });

  it("flattens the relation and serializes the date", async () => {
    findMany.mockResolvedValue([
      {
        id: "r1",
        rating: 5,
        comment: "Great quality",
        createdAt: new Date("2026-06-01T00:00:00.000Z"),
        user: { name: "Oleksandr" },
        product: { name: "Mirox Basic Hoodie", slug: "mirox-basic-hoodie" },
      },
    ]);

    const result = await getTestimonials();

    expect(result[0]).toEqual({
      id: "r1",
      rating: 5,
      comment: "Great quality",
      authorName: "Oleksandr",
      productName: "Mirox Basic Hoodie",
      productSlug: "mirox-basic-hoodie",
      createdAt: "2026-06-01T00:00:00.000Z",
    });
  });

  it("falls back to a neutral author label when the user has no name", async () => {
    findMany.mockResolvedValue([
      {
        id: "r2",
        rating: 4,
        comment: "Good",
        createdAt: new Date("2026-06-02T00:00:00.000Z"),
        user: { name: null },
        product: { name: "Tee", slug: "tee" },
      },
    ]);

    const result = await getTestimonials();

    expect(result[0].authorName).toBe("Verified customer");
  });

  it("drops rows whose comment is an empty string", async () => {
    findMany.mockResolvedValue([
      {
        id: "r3",
        rating: 5,
        comment: "   ",
        createdAt: new Date("2026-06-03T00:00:00.000Z"),
        user: { name: "A" },
        product: { name: "Tee", slug: "tee" },
      },
    ]);

    const result = await getTestimonials();

    expect(result).toEqual([]);
  });
});
