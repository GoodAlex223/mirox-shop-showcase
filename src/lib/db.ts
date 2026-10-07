import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "DATABASE_URL environment variable is not set. " + "Please configure it in your environment."
    );
  }

  // Use Neon adapter only in production with Neon database
  // Local development uses standard PostgreSQL connection
  const isNeonDatabase =
    connectionString.includes("neon.tech") || connectionString.includes("neon.database");

  if (isNeonDatabase) {
    // Dynamic import for Neon adapter to avoid issues in local dev
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PrismaNeon } = require("@prisma/adapter-neon");
    const adapter = new PrismaNeon({ connectionString });
    return new PrismaClient({
      adapter,
      log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    });
  }

  // Standard PostgreSQL connection for local development
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;
