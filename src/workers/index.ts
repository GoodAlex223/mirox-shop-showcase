import { startOrderForwardingWorker } from "./order-forwarding.worker";
import { startOrderStatusSyncWorker } from "./order-status-sync.worker";

console.log("Starting all workers...");

// Start both workers
const orderForwardingWorker = startOrderForwardingWorker();
const orderStatusSyncWorker = startOrderStatusSyncWorker();

// Graceful shutdown
async function shutdown() {
  console.log("\nShutting down workers...");

  await Promise.all([orderForwardingWorker.close(), orderStatusSyncWorker.close()]);

  console.log("Workers stopped");
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

console.log("All workers started. Press Ctrl+C to stop.");
