import { Queue, Job } from "bullmq";
import { getRedisConnectionOptions } from "./redis";

// Queue names
export const QUEUE_NAMES = {
  ORDER_FORWARDING: "order-forwarding",
  ORDER_STATUS_SYNC: "order-status-sync",
} as const;

// Job types
export interface OrderForwardingJobData {
  orderId: string;
  supplierOrderId: string;
  supplierId: string;
  attempt?: number;
}

export interface OrderStatusSyncJobData {
  supplierOrderId: string;
  supplierId: string;
}

// Queue instances (lazy initialization)
let orderForwardingQueue: Queue | null = null;
let orderStatusSyncQueue: Queue | null = null;

export function getOrderForwardingQueue(): Queue<OrderForwardingJobData> {
  if (!orderForwardingQueue) {
    orderForwardingQueue = new Queue(QUEUE_NAMES.ORDER_FORWARDING, {
      connection: getRedisConnectionOptions(),
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 5000,
        },
        removeOnComplete: {
          age: 24 * 60 * 60, // Keep completed jobs for 24 hours
          count: 1000, // Keep last 1000 completed jobs
        },
        removeOnFail: {
          age: 7 * 24 * 60 * 60, // Keep failed jobs for 7 days
        },
      },
    });
  }
  return orderForwardingQueue as Queue<OrderForwardingJobData>;
}

export function getOrderStatusSyncQueue(): Queue<OrderStatusSyncJobData> {
  if (!orderStatusSyncQueue) {
    orderStatusSyncQueue = new Queue(QUEUE_NAMES.ORDER_STATUS_SYNC, {
      connection: getRedisConnectionOptions(),
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 10000,
        },
        removeOnComplete: {
          age: 24 * 60 * 60,
          count: 1000,
        },
        removeOnFail: {
          age: 7 * 24 * 60 * 60,
        },
      },
    });
  }
  return orderStatusSyncQueue as Queue<OrderStatusSyncJobData>;
}

// Helper to add job to order forwarding queue
export async function queueOrderForwarding(
  orderId: string,
  supplierOrderId: string,
  supplierId: string,
  delay?: number
): Promise<Job<OrderForwardingJobData>> {
  const queue = getOrderForwardingQueue();
  return queue.add(
    "forward-order",
    { orderId, supplierOrderId, supplierId },
    {
      delay,
      jobId: `forward-${supplierOrderId}`,
    }
  );
}

// Helper to add job to status sync queue
export async function queueOrderStatusSync(
  supplierOrderId: string,
  supplierId: string,
  delay?: number
): Promise<Job<OrderStatusSyncJobData>> {
  const queue = getOrderStatusSyncQueue();
  return queue.add(
    "sync-status",
    { supplierOrderId, supplierId },
    {
      delay,
      jobId: `sync-${supplierOrderId}`,
    }
  );
}

// Get queue statistics
export async function getQueueStats(queueName: string) {
  const queue = new Queue(queueName, { connection: getRedisConnectionOptions() });

  const [waiting, active, completed, failed, delayed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
    queue.getDelayedCount(),
  ]);

  await queue.close();

  return {
    waiting,
    active,
    completed,
    failed,
    delayed,
    total: waiting + active + delayed,
  };
}
