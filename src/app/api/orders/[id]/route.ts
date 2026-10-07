import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    const { id } = await params;

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const order = await prisma.order.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
      include: {
        items: {
          include: {
            product: {
              select: {
                slug: true,
                images: {
                  take: 1,
                  orderBy: { position: "asc" },
                },
              },
            },
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Transform order for JSON serialization
    const transformedOrder = {
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
        productSlug: item.product.slug,
      })),
    };

    return NextResponse.json(transformedOrder);
  } catch {
    return NextResponse.json({ error: "Failed to fetch order" }, { status: 500 });
  }
}
