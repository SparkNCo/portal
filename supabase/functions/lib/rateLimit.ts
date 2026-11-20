// @ts-nocheck
// Fixed-window rate limit on Upstash Redis, for routes that call an AI model
// (each call costs money). One counter per key and window:
//   ratelimit:<key>:<window number>  — INCR, expires with the window.
//
// Fails open: if Redis can't be reached the request goes through (logged), so
// an Upstash outage doesn't take the feature down with it.
import { redis } from "./redis.ts";

export type RateLimitResult = { allowed: boolean; retryAfterSeconds: number };

export async function consumeRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const window = Math.floor(nowSeconds / windowSeconds);
  const retryAfterSeconds = (window + 1) * windowSeconds - nowSeconds;
  const redisKey = `ratelimit:${key}:${window}`;

  try {
    const count = await redis.incr(redisKey);
    if (count === 1) await redis.expire(redisKey, windowSeconds);
    return { allowed: count <= limit, retryAfterSeconds };
  } catch (err) {
    console.error(`[rateLimit] Redis unavailable, letting "${key}" through`, err);
    return { allowed: true, retryAfterSeconds: 0 };
  }
}

// "in 12 minutes" / "in 3 hours", for the error message.
export function describeRetryAfter(seconds: number): string {
  if (seconds < 90) return "in a minute";
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 90) return `in ${minutes} minutes`;
  return `in ${Math.ceil(minutes / 60)} hours`;
}
