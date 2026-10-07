import { RedisOptions } from "ioredis";

// Parse Redis URL into RedisOptions for BullMQ compatibility
export function parseRedisUrl(url?: string): RedisOptions {
  const redisUrl = url || process.env.REDIS_URL || "redis://localhost:6379";
  const parsed = new URL(redisUrl);

  return {
    host: parsed.hostname,
    port: parseInt(parsed.port || "6379", 10),
    password: parsed.password || undefined,
    username: parsed.username || undefined,
    db: parsed.pathname ? parseInt(parsed.pathname.slice(1), 10) : 0,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  };
}

// Get Redis connection options for BullMQ
export function getRedisConnectionOptions(): RedisOptions {
  return parseRedisUrl();
}
