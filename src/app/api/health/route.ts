import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

interface HealthCheck {
  status: "ok" | "degraded" | "error";
  timestamp: string;
  version: string;
  uptime: number;
  checks: {
    database: {
      status: "ok" | "error";
      latency?: number;
      error?: string;
    };
    redis?: {
      status: "ok" | "error";
      latency?: number;
      error?: string;
    };
  };
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const startTime = Date.now();

  const health: HealthCheck = {
    status: "ok",
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || "0.1.0",
    uptime: process.uptime(),
    checks: {
      database: {
        status: "ok",
      },
    },
  };

  // Check database connectivity
  try {
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    health.checks.database.latency = Date.now() - dbStart;
  } catch (error) {
    health.checks.database.status = "error";
    health.checks.database.error =
      error instanceof Error ? error.message : "Unknown database error";
    health.status = "error";
  }

  // Check Redis connectivity (optional)
  if (process.env.REDIS_URL) {
    try {
      const { default: Redis } = await import("ioredis");
      const redis = new Redis(process.env.REDIS_URL, {
        maxRetriesPerRequest: 1,
        connectTimeout: 5000,
      });

      const redisStart = Date.now();
      await redis.ping();
      health.checks.redis = {
        status: "ok",
        latency: Date.now() - redisStart,
      };
      await redis.quit();
    } catch (error) {
      health.checks.redis = {
        status: "error",
        error: error instanceof Error ? error.message : "Unknown Redis error",
      };
      // Redis being down is degraded, not error
      if (health.status === "ok") {
        health.status = "degraded";
      }
    }
  }

  // Set appropriate HTTP status
  const httpStatus = health.status === "ok" ? 200 : health.status === "degraded" ? 200 : 503;

  return NextResponse.json(health, {
    status: httpStatus,
    headers: {
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "X-Response-Time": `${Date.now() - startTime}ms`,
    },
  });
}
