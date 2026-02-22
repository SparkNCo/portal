import { Redis } from "@upstash/redis";

if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
  throw new Error(
    "Missing Upstash Redis REST environment variables: UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN"
  );
}

// Create a Redis client using the Upstash REST API
export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

// Example usage:
// await redis.set("key", "value");
// const value = await redis.get("key");
