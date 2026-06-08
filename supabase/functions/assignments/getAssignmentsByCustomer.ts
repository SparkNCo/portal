// @ts-nocheck
import { supabase } from "../client.ts";
import { corsHeaders } from "../utils/headers.ts";

export const getAssignmentsByCustomer = async (req: Request) => {
  try {

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

    let query = supabase.schema("portal")
      .from("assignments")
      .select(
        `
        customer_id,
        user_id,
        allocation,
        joined,
        role,
        users!user_id (
          id,
          email,
          role
        )
      `,
      )
      .in("customer_id", customer_ids);

    if (onlyDev) query = query.eq("role", "developer");

    const { data, error } = await query;

    if (error) {
      console.error("[Supabase ERROR]:", error);
      throw new Error(error.message);
    }

    const users = (data ?? [])
      .filter((row: any) => row.users)
      .map((row: any) => ({
        ...row.users,
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
