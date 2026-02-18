/**
 * Rate limiting using Vercel KV with sliding window
 *
 * Prevents spam by limiting requests per time window
 */

import { kv } from "@vercel/kv";

const RATE_LIMIT_PREFIX = "ratelimit:";

export interface RateLimitConfig {
    limit: number; // Max requests allowed
    window: number; // Time window in seconds
}

export interface RateLimitResult {
    success: boolean;
    remaining: number;
    reset: number; // Timestamp when limit resets
}

/**
 * Check if a request is allowed based on rate limit
 * Uses sliding window algorithm with Vercel KV
 */
export async function rateLimit(
    identifier: string,
    config: RateLimitConfig
): Promise<RateLimitResult> {
    const key = `${RATE_LIMIT_PREFIX}${identifier}`;
    const now = Date.now();
    const windowMs = config.window * 1000;
    const windowStart = now - windowMs;

    try {
        // Get current request timestamps
        const requests = (await kv.get<number[]>(key)) || [];

        // Filter out requests outside the window
        const validRequests = requests.filter((timestamp) => timestamp > windowStart);

        // Check if limit exceeded
        if (validRequests.length >= config.limit) {
            const oldestRequest = Math.min(...validRequests);
            const reset = oldestRequest + windowMs;

            return {
                success: false,
                remaining: 0,
                reset,
            };
        }

        // Add current request
        const updatedRequests = [...validRequests, now];

        // Store with TTL slightly longer than window to allow cleanup
        await kv.set(key, updatedRequests, { ex: config.window + 60 });

        return {
            success: true,
            remaining: config.limit - updatedRequests.length,
            reset: now + windowMs,
        };
    } catch (error) {
        console.error("Rate limit check failed:", error);
        // On error, deny the request (fail closed)
        return {
            success: false,
            remaining: 0,
            reset: now + windowMs,
        };
    }
}

/**
 * Common rate limit configurations
 */
export const RateLimits = {
    // Chat messages: 10 per minute
    CHAT_MESSAGE: {
        limit: 10,
        window: 60,
    },
    // Member registration: 5 per minute
    MEMBER_REGISTRATION: {
        limit: 5,
        window: 60,
    },
    // Presence heartbeat: 5 per minute (30s interval + buffer)
    PRESENCE_HEARTBEAT: {
        limit: 5,
        window: 60,
    },
    // General read endpoints: 30 per minute
    GENERAL_READ: {
        limit: 30,
        window: 60,
    },
    // Username check: 20 per minute
    USERNAME_CHECK: {
        limit: 20,
        window: 60,
    },
    // Referrer validation: 10 per minute
    REFERRER_VALIDATE: {
        limit: 10,
        window: 60,
    },
};
