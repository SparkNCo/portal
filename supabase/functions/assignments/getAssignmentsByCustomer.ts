// @ts-nocheck
import { supabase } from "../client.ts";
import { corsHeaders } from "../utils/headers.ts";

export const getAssignmentsByCustomer = async (req: Request) => {
  try {
    console.log("=== [GetAssignments] START ===");
    console.log("[Request URL]:", req.url);

    const url = new URL(req.url);
    const customer_id = url.searchParams.get("customer");
    console.log("[customer_id]:", customer_id);

    if (!customer_id) {
      console.warn("[GetAssignments] Missing customer param");
      return new Response(
        JSON.stringify({ error: "customer is required" }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    console.log("[GetAssignments] Running query using fk_user...");

    const { data, error } = await supabase
      .from("assignments")
      .select(
        `
        allocation,
        joined,
        users!fk_user (
          id,
          email,
          role
        )
      `,
      )
      .eq("customer_id", customer_id);

    if (error) {
      console.error("[Supabase ERROR]:", error);
      throw new Error(error.message);
    }

    const users = (data ?? [])
      .filter((row: any) => row.users)
      .map((row: any) => ({
        ...row.users,
        allocation: row.allocation,
        joined: row.joined,
      }));

    console.log("[GetAssignments] Query success");
    console.log("[Row count]:", users.length);
    console.log("[Sample row]:", users?.[0]);
    console.log("=== [GetAssignments] END ===");

    return new Response(JSON.stringify(users), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error("=== [GetAssignments ERROR] ===");
    console.error(error);
    console.error("=== [END ERROR] ===");

    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  }
};
