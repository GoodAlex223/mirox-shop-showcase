import { requireAdmin, apiError, apiSuccess } from "@/lib/api-utils";
import { getQueueStats, QUEUE_NAMES } from "@/lib/queue";

// GET /api/admin/queue - Get queue statistics
export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const [orderForwarding, orderStatusSync] = await Promise.all([
      getQueueStats(QUEUE_NAMES.ORDER_FORWARDING),
      getQueueStats(QUEUE_NAMES.ORDER_STATUS_SYNC),
    ]);

    return apiSuccess({
      queues: {
        orderForwarding: {
          name: QUEUE_NAMES.ORDER_FORWARDING,
          ...orderForwarding,
        },
        orderStatusSync: {
          name: QUEUE_NAMES.ORDER_STATUS_SYNC,
          ...orderStatusSync,
        },
      },
    });
  } catch {
    return apiError("Failed to fetch queue statistics", 500);
  }
}
