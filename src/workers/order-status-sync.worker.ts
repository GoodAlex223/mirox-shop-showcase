import { Worker, Job } from "bullmq";
import { getRedisConnectionOptions } from "../lib/redis";
import { QUEUE_NAMES, OrderStatusSyncJobData, queueOrderStatusSync } from "../lib/queue";
import { syncOrderStatus } from "../services/supplier.service";

async function processOrderStatusSync(job: Job<OrderStatusSyncJobData>) {
  const { supplierOrderId, supplierId } = job.data;

  console.log(`[Worker] Processing status sync job: ${job.id}`);
  console.log(`  - Supplier Order ID: ${supplierOrderId}`);

  try {
    const result = await syncOrderStatus(supplierOrderId);

    if (result.success) {
      console.log(`  - Status synced: ${result.status}`);
      if (result.trackingNumber) {
        console.log(`  - Tracking: ${result.trackingNumber}`);
      }

      // If not in terminal state, schedule another sync
      const terminalStates = ["delivered", "cancelled", "failed"];
      if (result.status && !terminalStates.includes(result.status.toLowerCase())) {
        // Schedule next sync in 4 hours
        await queueOrderStatusSync(supplierOrderId, supplierId, 4 * 60 * 60 * 1000);
        console.log(`  - Scheduled next sync in 4 hours`);
      }

      return { success: true, status: result.status };
    } else {
      console.log(`  - Sync failed: ${result.errorMessage}`);
      return { success: false, error: result.errorMessage };
    }
  } catch (error) {
    console.error(`[Worker] Error processing job ${job.id}:`, error);
    throw error;
  }
}

// Create and start the worker
export function startOrderStatusSyncWorker() {
  const worker = new Worker<OrderStatusSyncJobData>(
    QUEUE_NAMES.ORDER_STATUS_SYNC,
    processOrderStatusSync,
    {
      connection: getRedisConnectionOptions(),
      concurrency: 10,
      limiter: {
        max: 20,
        duration: 1000,
      },
    }
  );

  worker.on("completed", (job) => {
    console.log(`[Worker] Sync job ${job.id} completed`);
  });

  worker.on("failed", (job, error) => {
    console.error(`[Worker] Sync job ${job?.id} failed:`, error);
  });

  worker.on("error", (error) => {
    console.error(`[Worker] Sync worker error:`, error);
  });

  console.log("[Worker] Order status sync worker started");

  return worker;
}

// For direct execution
if (require.main === module) {
  startOrderStatusSyncWorker();
}
