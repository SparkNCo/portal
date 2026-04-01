// @ts-nocheck
import { supabase } from "../client.ts";
import { corsHeaders } from "../utils/headers.ts";

export const getAssignmentsByDeveloper = async (req: Request) => {
  try {
    const url = new URL(req.url);
    const developer_id = url.searchParams.get("developer");

    if (!developer_id) {
      return new Response(
        JSON.stringify({ error: "developer id is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    /**
     * 1. Get all assignments where user_id = developer_id
     */
    const { data: assignments, error: assignmentsError } = await supabase
      .from("assignments")
      .select("id, role, allocation, joined, customer_id")
      .eq("user_id", developer_id);

    if (assignmentsError) throw new Error(assignmentsError.message);

    if (!assignments || assignments.length === 0) {
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    /**
     * 2. Fetch customer emails for each customer_id
     */
    const customerIds = assignments.map((a) => a.customer_id);

    const { data: customers, error: customersError } = await supabase
      .from("users")
      .select("id, email")
      .in("id", customerIds);

    if (customersError) throw new Error(customersError.message);

    const customerMap = Object.fromEntries(
      customers.map((c) => [c.id, c.email]),
    );

    /**
     * 3. Merge and return
     */
    const result = assignments.map((a) => ({
      ...a,
      customer_email: customerMap[a.customer_id] ?? null,
    }));

    console.log("[getAssignmentsByDeveloper] result:", result);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[getAssignmentsByDeveloper]", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};
