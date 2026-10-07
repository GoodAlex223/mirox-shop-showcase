import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, apiError, apiSuccess } from "@/lib/api-utils";
import { createSupplierOrdersForOrder } from "@/services/supplier.service";
import { queueOrderForwarding } from "@/lib/queue";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/admin/orders/[id]/forward - Forward order to suppliers
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const { id } = await params;

    // Fetch the order
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: {
              include: {
                supplier: true,
              },
            },
          },
        },
        supplierOrders: true,
      },
    });

    if (!order) {
      return apiError("Order not found", 404);
    }

    // Check if order is in a valid state for forwarding
    if (order.paymentStatus !== "PAID") {
      return apiError("Cannot forward unpaid orders", 400);
    }

    if (order.status === "CANCELLED" || order.status === "REFUNDED") {
      return apiError("Cannot forward cancelled or refunded orders", 400);
    }

    // Create supplier orders if they don't exist
    const supplierOrderIds = await createSupplierOrdersForOrder(id);

    if (supplierOrderIds.length === 0) {
      return apiError("No products with suppliers found in this order", 400);
    }

    // Queue forwarding jobs for each supplier order
    const queuedJobs = [];
    for (const supplierOrderId of supplierOrderIds) {
      const supplierOrder = await prisma.supplierOrder.findUnique({
        where: { id: supplierOrderId },
      });

      if (supplierOrder && supplierOrder.status === "pending") {
        const job = await queueOrderForwarding(id, supplierOrderId, supplierOrder.supplierId);
        queuedJobs.push({
          jobId: job.id,
          supplierOrderId,
          supplierId: supplierOrder.supplierId,
        });
      }
    }

    // Update order status to processing if needed
    if (order.status === "CONFIRMED" || order.status === "PENDING") {
      await prisma.order.update({
        where: { id },
        data: { status: "PROCESSING" },
      });
    }

    return apiSuccess({
      message: `Queued ${queuedJobs.length} supplier order(s) for forwarding`,
      supplierOrders: supplierOrderIds.length,
      queuedJobs,
    });
  } catch {
    return apiError("Failed to forward order", 500);
  }
}
