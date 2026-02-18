import Redis from "ioredis";

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
        if (times > 3) return null; // stop retrying
        return Math.min(times * 500, 2000);
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
