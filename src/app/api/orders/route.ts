import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const status = searchParams.get("status");

    const skip = (page - 1) * limit;

    const where: Prisma.OrderWhereInput = {
      userId: session.user.id,
      ...(status && status !== "all" ? { status: status as Prisma.EnumOrderStatusFilter } : {}),
    };

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          items: {
            include: {
              product: {
                select: {
                  images: {
                    take: 1,
                    orderBy: { position: "asc" },
                  },
                },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.order.count({ where }),
    ]);

    // Transform orders to include first product image
    const transformedOrders = orders.map((order) => ({
      ...order,
      subtotal: order.subtotal.toString(),
      shippingCost: order.shippingCost.toString(),
      discount: order.discount.toString(),
      tax: order.tax.toString(),
      total: order.total.toString(),
      items: order.items.map((item) => ({
        ...item,
        unitPrice: item.unitPrice.toString(),
        totalPrice: item.totalPrice.toString(),
        image: item.product.images[0]?.url || null,
      })),
    }));

    return NextResponse.json({
      orders: transformedOrders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch orders" }, { status: 500 });
  }
}
