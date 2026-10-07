import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { apiError, apiSuccess, getPagination, paginatedResponse } from "@/lib/api-utils";

interface RouteParams {
  params: Promise<{ slug: string }>;
}

// GET /api/products/[slug]/reviews - Public reviews for a product
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { slug } = await params;
    const searchParams = request.nextUrl.searchParams;
    const { page, limit, skip } = getPagination(searchParams);
    const ratingFilter = searchParams.get("rating");

    const product = await prisma.product.findUnique({
      where: { slug, isActive: true },
      select: { id: true },
    });

    if (!product) {
      return apiError("Product not found", 404);
    }

    const ratingNum = ratingFilter ? parseInt(ratingFilter, 10) : NaN;
    const validRating = !isNaN(ratingNum) && ratingNum >= 1 && ratingNum <= 5;

    const where = {
      productId: product.id,
      isHidden: false,
      ...(validRating ? { rating: ratingNum } : {}),
    };

    const [reviews, total, stats] = await Promise.all([
      prisma.review.findMany({
        where,
        select: {
          id: true,
          rating: true,
          comment: true,
          adminReply: true,
          adminRepliedAt: true,
          createdAt: true,
          user: { select: { id: true, name: true, image: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.review.count({ where }),
      prisma.review.aggregate({
        where: { productId: product.id, isHidden: false },
        _avg: { rating: true },
        _count: true,
      }),
    ]);

    // Calculate rating distribution
    const distribution = await prisma.review.groupBy({
      by: ["rating"],
      where: { productId: product.id, isHidden: false },
      _count: true,
    });

    const ratingDistribution = [5, 4, 3, 2, 1].map((r) => ({
      rating: r,
      count: distribution.find((d) => d.rating === r)?._count ?? 0,
    }));

    return apiSuccess({
      ...paginatedResponse(reviews, total, { page, limit, skip }),
      averageRating: stats._avg.rating ?? 0,
      totalReviews: stats._count,
      ratingDistribution,
    });
  } catch {
    return apiError("Failed to fetch reviews", 500);
  }
}
