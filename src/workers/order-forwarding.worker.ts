import { Worker, Job } from "bullmq";
import { getRedisConnectionOptions } from "../lib/redis";
import { QUEUE_NAMES, OrderForwardingJobData, queueOrderStatusSync } from "../lib/queue";
import { forwardOrderToSupplier, SupplierOrderPayload } from "../services/supplier.service";
import { PrismaClient } from "@prisma/client";

// Use a separate Prisma instance for the worker
const prisma = new PrismaClient();

async function processOrderForwarding(job: Job<OrderForwardingJobData>) {
  const { orderId, supplierOrderId, supplierId, attempt } = job.data;

  console.log(`[Worker] Processing order forwarding job: ${job.id}`);
  console.log(`  - Order ID: ${orderId}`);
  console.log(`  - Supplier Order ID: ${supplierOrderId}`);
  console.log(`  - Supplier ID: ${supplierId}`);
  console.log(`  - Attempt: ${attempt || 1}`);

  try {
    // Fetch the order and supplier order details
    const supplierOrder = await prisma.supplierOrder.findUnique({
      where: { id: supplierOrderId },
      include: {
        order: {
          include: {
            items: {
              include: {
                product: true,
              },
            },
          },
        },
        supplier: true,
      },
    });

    if (!supplierOrder) {
      throw new Error(`Supplier order ${supplierOrderId} not found`);
    }

    if (supplierOrder.status !== "pending") {
      console.log(`  - Supplier order already processed: ${supplierOrder.status}`);
      return { skipped: true, reason: "Already processed" };
    }

    const order = supplierOrder.order;

    // Filter items for this supplier
    const supplierItems = order.items.filter((item) => item.product.supplierId === supplierId);

    if (supplierItems.length === 0) {
      throw new Error("No items found for this supplier");
    }

    // Parse shipping address
    const shippingAddress = order.shippingAddress as {
      name: string;
      company?: string;
      line1: string;
      line2?: string;
      city: string;
      state?: string;
      postalCode: string;
      country: string;
      phone?: string;
    };

    // Build the payload
    const payload: SupplierOrderPayload = {
      orderId: order.id,
      orderNumber: order.orderNumber,
      items: supplierItems.map((item) => ({
        productId: item.productId,
        productName: item.productName,
        sku: item.productSku,
        supplierSku: item.product.supplierSku,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
      })),
      shippingAddress,
      customerEmail: order.email,
      customerNotes: order.customerNotes || undefined,
    };

    // Forward to supplier
    const result = await forwardOrderToSupplier(supplierId, supplierOrderId, payload);

    if (result.success) {
      console.log(`  - Order forwarded successfully`);
      if (result.supplierOrderId) {
        console.log(`  - Supplier order ID: ${result.supplierOrderId}`);
      }

      // Schedule status sync for later
      await queueOrderStatusSync(supplierOrderId, supplierId, 60 * 60 * 1000); // 1 hour delay
      console.log(`  - Scheduled status sync in 1 hour`);

      return { success: true, supplierOrderId: result.supplierOrderId };
    } else {
      throw new Error(result.errorMessage || "Unknown error");
    }
  } catch (error) {
    console.error(`[Worker] Error processing job ${job.id}:`, error);
    throw error; // Rethrow to trigger retry
  }
}

// Create and start the worker
export function startOrderForwardingWorker() {
  const worker = new Worker<OrderForwardingJobData>(
    QUEUE_NAMES.ORDER_FORWARDING,
    processOrderForwarding,
    {
      connection: getRedisConnectionOptions(),
      concurrency: 5, // Process up to 5 jobs simultaneously
      limiter: {
        max: 10, // Max 10 jobs per second (rate limiting for API calls)
        duration: 1000,
      },
    }
  );

  worker.on("completed", (job) => {
    console.log(`[Worker] Job ${job.id} completed`);
  });

  worker.on("failed", (job, error) => {
    console.error(`[Worker] Job ${job?.id} failed:`, error);
  });

  worker.on("error", (error) => {
    console.error(`[Worker] Worker error:`, error);
  });

  console.log("[Worker] Order forwarding worker started");

  return worker;
}

// For direct execution
if (require.main === module) {
  startOrderForwardingWorker();
}
