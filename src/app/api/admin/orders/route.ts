import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, apiError, getPagination, paginatedResponse } from "@/lib/api-utils";
import { Prisma } from "@prisma/client";

export async function GET(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const { searchParams } = new URL(request.url);
    const pagination = getPagination(searchParams);

    // Filters
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status");
    const paymentStatus = searchParams.get("paymentStatus");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const sortBy = searchParams.get("sortBy") || "createdAt";
    const sortOrder = searchParams.get("sortOrder") || "desc";

    // Build where clause
    const where: Prisma.OrderWhereInput = {};

    if (search) {
      where.OR = [
        { orderNumber: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { user: { name: { contains: search, mode: "insensitive" } } },
      ];
    }

    if (status && status !== "all") {
      where.status = status as Prisma.EnumOrderStatusFilter;
    }

    if (paymentStatus && paymentStatus !== "all") {
      where.paymentStatus = paymentStatus as Prisma.EnumPaymentStatusFilter;
    }

    if (dateFrom) {
      where.createdAt = {
        ...((where.createdAt as Prisma.DateTimeFilter) || {}),
        gte: new Date(dateFrom),
      };
    }

    if (dateTo) {
      where.createdAt = {
        ...((where.createdAt as Prisma.DateTimeFilter) || {}),
        lte: new Date(dateTo + "T23:59:59.999Z"),
      };
    }

    // Build orderBy
    const orderBy: Prisma.OrderOrderByWithRelationInput = {
      [sortBy]: sortOrder as Prisma.SortOrder,
    };

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          items: {
            select: {
              id: true,
              quantity: true,
            },
          },
        },
        orderBy,
        skip: pagination.skip,
        take: pagination.limit,
      }),
      prisma.order.count({ where }),
    ]);

    // Transform orders for JSON serialization
    const transformedOrders = orders.map((order) => ({
      ...order,
      subtotal: order.subtotal.toString(),
      shippingCost: order.shippingCost.toString(),
      discount: order.discount.toString(),
      tax: order.tax.toString(),
      total: order.total.toString(),
      itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
      items: undefined, // Remove items from list view
    }));

    return NextResponse.json(paginatedResponse(transformedOrders, total, pagination));
  } catch {
    return apiError("Failed to fetch orders", 500);
  }
}
