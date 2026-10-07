import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import {
  requireAdmin,
  apiError,
  apiSuccess,
  getPagination,
  paginatedResponse,
} from "@/lib/api-utils";

// GET /api/admin/reviews - List all reviews with filters
export async function GET(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const searchParams = request.nextUrl.searchParams;
    const { page, limit, skip } = getPagination(searchParams);

    const search = searchParams.get("search") || "";
    const productId = searchParams.get("productId");
    const rating = searchParams.get("rating");
    const isHidden = searchParams.get("isHidden");
    const hasReply = searchParams.get("hasReply");

    const where: Prisma.ReviewWhereInput = {};

    if (search) {
      where.OR = [
        { comment: { contains: search, mode: "insensitive" } },
        { product: { name: { contains: search, mode: "insensitive" } } },
        { user: { name: { contains: search, mode: "insensitive" } } },
        { user: { email: { contains: search, mode: "insensitive" } } },
      ];
    }

    if (productId) where.productId = productId;
    if (rating) {
      const ratingNum = parseInt(rating, 10);
      if (!isNaN(ratingNum) && ratingNum >= 1 && ratingNum <= 5) {
        where.rating = ratingNum;
      }
    }
    if (isHidden === "true") where.isHidden = true;
    if (isHidden === "false") where.isHidden = false;
    if (hasReply === "true") where.adminReply = { not: null };
    if (hasReply === "false") where.adminReply = null;

    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where,
        select: {
          id: true,
          rating: true,
          comment: true,
          isHidden: true,
          adminReply: true,
          adminRepliedAt: true,
          createdAt: true,
          product: { select: { id: true, name: true, slug: true } },
          user: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.review.count({ where }),
    ]);

    return apiSuccess(paginatedResponse(reviews, total, { page, limit, skip }));
  } catch {
    return apiError("Failed to fetch reviews", 500);
  }
}
