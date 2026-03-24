// @ts-nocheck
import { supabase } from "../client.ts";
import { corsHeaders } from "../utils/headers.ts";

export const getAssignmentsByCustomer = async (req: Request) => {
  try {
    console.log("=== [GetAssignments] START ===");
    console.log("[Request URL]:", req.url);

    const url = new URL(req.url);
    const customer_id = url.searchParams.get("customer_id");
    console.log("[customer_id]:", customer_id);

    if (!customer_id) {
      console.warn("[GetAssignments] Missing customer_id");
      return new Response(
        JSON.stringify({ error: "customer_id is required" }),
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
        id,
        role,
        allocation,
        joined,
        user_id,
        users!fk_user (
          id,
          email
        )
      `,
      )
      .eq("customer_id", customer_id);

    if (error) {
      console.error("[Supabase ERROR]:", error);
      throw new Error(error.message);
    }

    console.log("[GetAssignments] Query success");
    console.log("[Row count]:", data?.length);
    console.log("[Sample row]:", data?.[0]);
    console.log("=== [GetAssignments] END ===");

    return new Response(JSON.stringify(data), {
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
