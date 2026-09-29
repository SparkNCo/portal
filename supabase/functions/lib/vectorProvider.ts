// @ts-nocheck
// Per-customer vector provider (customers.systems.vector: 'upstash' | 'pgvector').
import { supabase } from "../client.ts";

// Not cached: warm instances would ignore an admin's provider change until
// recycled. `namespace` = linear_slug; ilike because stored casing is inconsistent
// (an exact match would silently fall back to 'upstash').
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
