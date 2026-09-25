// @ts-nocheck
// SPA-513-Cycle20: per-customer vector provider switch (customers.systems.
// vector, 'upstash' | 'pgvector'), same idea as ChatProvider.tsx's
// systems.chat switch on the frontend — just resolved server-side here,
// since every vector call already happens inside an edge function.
import { supabase } from "../client.ts";

// Deliberately not cached — an edge function instance can stay warm across
// several requests, and caching this would mean an admin flipping
// systems.vector for a customer doesn't actually take effect until that
// instance recycles. It's one indexed lookup; not worth the staleness risk.
//
// `namespace` is whatever the caller already uses as the Upstash namespace
// — project_slug for issues/documents/tests, which is the same value as
// customers.linear_slug. ilike (not eq) because that casing is inconsistent
// across real customer records (see 20260921190000-era linear_slug fixes) —
// an exact match here would silently fall back to the 'upstash' default for
// every customer whose slug differs only in case.
export async function resolveVectorProvider(namespace: string): Promise<"upstash" | "pgvector"> {
  try {
    const { data } = await supabase.schema("portal")
      .from("customers")
      .select("systems")
      .ilike("linear_slug", namespace.trim())
      .maybeSingle();
    return data?.systems?.vector === "pgvector" ? "pgvector" : "upstash";
  } catch (err) {
    console.error("[resolveVectorProvider] lookup failed, defaulting to upstash:", err);
    return "upstash";
  }
}
