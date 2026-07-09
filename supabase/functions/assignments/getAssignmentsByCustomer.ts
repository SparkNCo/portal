// @ts-nocheck
import { supabase } from "../client.ts";
import { corsHeaders } from "../utils/headers.ts";

export const getAssignmentsByCustomer = async (req: Request) => {
  try {
    const schema = "portal";

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
    // PostgREST's cached FK relationship metadata, which has been unreliable
    // for this table.
    let query = supabase.schema(schema)
      .from("assignments")
      .select("id, customer_id, user_id, allocation, joined, role")
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
          .select("id, email, role, userName, firstName, lastName, phoneNumber")
          .in("id", userIds)
      : { data: [], error: null };

    if (usersError) {
      console.error("[Supabase ERROR]:", usersError);
      throw new Error(usersError.message);
    }

    const userById = new Map((assignedUsers ?? []).map((u) => [u.id, u]));

    const { data: developerProfiles, error: developersError } = userIds.length
      ? await supabase.schema(schema)
          .from("developers")
          .select("user_id, bio, tech_stack, developer_type")
          .in("user_id", userIds)
      : { data: [], error: null };

    if (developersError) {
      console.error("[Supabase ERROR]:", developersError);
      throw new Error(developersError.message);
    }

    const developerByUserId = new Map(
      (developerProfiles ?? []).map((d) => [d.user_id, d]),
    );

    const users = (assignments ?? [])
      .filter((row: any) => userById.has(row.user_id))
      .map((row: any) => ({
        ...userById.get(row.user_id),
        customer_id: row.customer_id,
        user_id: row.user_id,
        assignment_id: row.id,
        allocation: row.allocation,
        joined: row.joined,
        role: row.role,
        bio: developerByUserId.get(row.user_id)?.bio ?? null,
        tech_stack: developerByUserId.get(row.user_id)?.tech_stack ?? [],
        developer_type: developerByUserId.get(row.user_id)?.developer_type ?? "spark_fde",
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
