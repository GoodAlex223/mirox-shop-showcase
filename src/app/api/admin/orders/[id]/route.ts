import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, apiError } from "@/lib/api-utils";
import { updateOrderStatusSchema } from "@/lib/validations";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const { id } = await params;

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        items: {
          include: {
            product: {
              select: {
                id: true,
                slug: true,
                images: {
                  take: 1,
                  orderBy: { position: "asc" },
                },
              },
            },
          },
        },
        supplierOrders: {
          include: {
            supplier: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
          },
        },
      },
    });

    if (!order) {
      return apiError("Order not found", 404);
    }

    // Transform for JSON serialization
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
      supplierOrders: order.supplierOrders.map((so) => ({
        ...so,
        cost: so.cost?.toString() || null,
      })),
    };

    return NextResponse.json(transformedOrder);
  } catch {
    return apiError("Failed to fetch order", 500);
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const { id } = await params;
    const body = await request.json();
    const data = updateOrderStatusSchema.parse(body);

    const order = await prisma.order.findUnique({
      where: { id },
    });

    if (!order) {
      return apiError("Order not found", 404);
    }

    const updatedOrder = await prisma.order.update({
      where: { id },
      data: {
        status: data.status,
        trackingNumber: data.trackingNumber,
        trackingUrl: data.trackingUrl,
        notes: data.notes ? `${order.notes || ""}\n${data.notes}`.trim() : order.notes,
      },
    });

    return NextResponse.json({
      ...updatedOrder,
      subtotal: updatedOrder.subtotal.toString(),
      shippingCost: updatedOrder.shippingCost.toString(),
      discount: updatedOrder.discount.toString(),
      tax: updatedOrder.tax.toString(),
      total: updatedOrder.total.toString(),
    });
  } catch {
    return apiError("Failed to update order", 500);
  }
}
