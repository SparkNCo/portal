
// @ts-nocheck
import { Redis } from "https://deno.land/x/upstash_redis@v1.19.3/mod.ts";

export const redis = new Redis({
  url: Deno.env.get("UPSTASH_REDIS_REST_URL")!,
  token: Deno.env.get("UPSTASH_REDIS_REST_TOKEN")!,
});