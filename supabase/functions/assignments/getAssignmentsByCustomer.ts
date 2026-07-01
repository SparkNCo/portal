// @ts-nocheck
import { supabase } from "../client.ts";
import { corsHeaders } from "../utils/headers.ts";
import { resolvePortalSchema } from "../utils/schema.ts";

export const getAssignmentsByCustomer = async (req: Request) => {
  try {
    const schema = resolvePortalSchema(req);

    const url = new URL(req.url);
    const raw = url.searchParams.get("customer_id");

    if (!raw) {
      return new Response(
        JSON.stringify({ error: "customer_id is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const customer_ids = raw.split(",").map((id) => id.trim()).filter(Boolean);
    const onlyDev = url.searchParams.get("onlyDev") === "true";

    // Two plain queries + manual merge instead of a PostgREST embedded
    // resource (`users!user_id (...)`) — the embedded join depends on
    // PostgREST's cached FK relationship metadata for the schema being
    // queried, which can be missing/stale for schemas like `portaldev`
    // even when the same FK exists in `portal`.
    let query = supabase.schema(schema)
      .from("assignments")
      .select("customer_id, user_id, allocation, joined, role")
      .in("customer_id", customer_ids);

    if (onlyDev) query = query.eq("role", "developer");

    const { data: assignments, error } = await query;

    if (error) {
      console.error("[Supabase ERROR]:", error);
      throw new Error(error.message);
    }

    const userIds = [...new Set((assignments ?? []).map((a) => a.user_id))];

    const { data: assignedUsers, error: usersError } = userIds.length
      ? await supabase.schema(schema)
          .from("users")
          .select("id, email, role")
          .in("id", userIds)
      : { data: [], error: null };

    if (usersError) {
      console.error("[Supabase ERROR]:", usersError);
      throw new Error(usersError.message);
    }

    const userById = new Map((assignedUsers ?? []).map((u) => [u.id, u]));

    const users = (assignments ?? [])
      .filter((row: any) => userById.has(row.user_id))
      .map((row: any) => ({
        ...userById.get(row.user_id),
        customer_id: row.customer_id,
        user_id: row.user_id,
        allocation: row.allocation,
        joined: row.joined,
        role: row.role,
      }));

    return new Response(JSON.stringify(users), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  }
};
