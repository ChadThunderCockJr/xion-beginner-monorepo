import Redis from "ioredis";
import { REDIS_MAX_RETRIES, REDIS_RETRY_DELAY_MIN_MS, REDIS_RETRY_DELAY_MAX_MS } from "./config.js";

let redis: Redis | null = null;

export function getRedis(): Redis | null {
  if (redis) return redis;

  const url = process.env.REDIS_URL || "redis://localhost:6379";
  try {
    redis = new Redis(url, {
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      retryStrategy(times) {
        if (times > REDIS_MAX_RETRIES) return null; // stop retrying
        return Math.min(times * REDIS_RETRY_DELAY_MIN_MS, REDIS_RETRY_DELAY_MAX_MS);
      },
    });

    redis.on("error", (err) => {
      console.error("[Redis] Connection error:", err.message);
    });

    redis.on("connect", () => {
      console.log("[Redis] Connected");
    });

    redis.connect().catch(() => {
      console.warn("[Redis] Initial connection failed — social features unavailable");
    });

    return redis;
  } catch (err) {
    console.error("[Redis] Failed to create client:", err);
    return null;
  }
}
