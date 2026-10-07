import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, apiError } from "@/lib/api-utils";
import { toCsv } from "@/lib/csv";
import { Prisma } from "@prisma/client";

export async function GET(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const { searchParams } = new URL(request.url);

    // Filters (same as list endpoint)
    const status = searchParams.get("status");
    const paymentStatus = searchParams.get("paymentStatus");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");

    // Build where clause
    const where: Prisma.OrderWhereInput = {};

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

    const orders = await prisma.order.findMany({
      where,
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
        items: {
          select: {
            productName: true,
            productSku: true,
            variantInfo: true,
            quantity: true,
            unitPrice: true,
            totalPrice: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Generate CSV
    const headers = [
      "Order Number",
      "Date",
      "Customer Name",
      "Customer Email",
      "Status",
      "Payment Status",
      "Items",
      "Subtotal",
      "Shipping",
      "Tax",
      "Discount",
      "Total",
      "Shipping Name",
      "Shipping Address",
      "Shipping City",
      "Shipping State",
      "Shipping Postal Code",
      "Shipping Country",
      "Tracking Number",
      "Notes",
    ];

    const rows = orders.map((order) => {
      const shippingAddress = order.shippingAddress as Record<string, string>;
      const itemsSummary = order.items
        .map((item) => `${item.productName} x${item.quantity}`)
        .join("; ");

      return [
        order.orderNumber,
        new Date(order.createdAt).toISOString(),
        order.user?.name || shippingAddress?.name || "",
        order.user?.email || order.email,
        order.status,
        order.paymentStatus,
        itemsSummary,
        order.subtotal.toString(),
        order.shippingCost.toString(),
        order.tax.toString(),
        order.discount.toString(),
        order.total.toString(),
        shippingAddress?.name || "",
        `${shippingAddress?.line1 || ""} ${shippingAddress?.line2 || ""}`.trim(),
        shippingAddress?.city || "",
        shippingAddress?.state || "",
        shippingAddress?.postalCode || "",
        shippingAddress?.country || "",
        order.trackingNumber || "",
        order.notes || "",
      ];
    });

    const csvContent = toCsv([headers, ...rows]);

    const filename = `orders-export-${new Date().toISOString().split("T")[0]}.csv`;

    return new NextResponse(csvContent, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch {
    return apiError("Failed to export orders", 500);
  }
}
