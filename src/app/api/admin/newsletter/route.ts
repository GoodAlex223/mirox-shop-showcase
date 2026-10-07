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

// GET /api/admin/newsletter - List subscribers with filters
export async function GET(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const searchParams = request.nextUrl.searchParams;
    const { page, limit, skip } = getPagination(searchParams);

    const search = searchParams.get("search") || "";
    const status = searchParams.get("status");

    const where: Prisma.SubscriberWhereInput = {};

    if (search) {
      where.email = { contains: search, mode: "insensitive" };
    }

    if (status && status !== "all") {
      where.status = status as Prisma.EnumSubscriberStatusFilter;
    }

    const [subscribers, total] = await Promise.all([
      prisma.subscriber.findMany({
        where,
        select: {
          id: true,
          email: true,
          status: true,
          subscribedAt: true,
          unsubscribedAt: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.subscriber.count({ where }),
    ]);

    return apiSuccess(paginatedResponse(subscribers, total, { page, limit, skip }));
  } catch {
    return apiError("Failed to fetch subscribers", 500);
  }
}
