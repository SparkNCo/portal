// @ts-nocheck
import { supabase } from "../client.ts";
import { corsHeaders } from "../utils/headers.ts";

// `users.customer_id` may still hold legacy Stripe customer IDs (e.g. "cus_...")
// for rows that predate the customers table migration; only UUIDs match `customers.customer_id`.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
    const { data: assignments, error: assignmentsError } = await supabase.schema("portal")
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
     * 2. Fetch customer users (email + link to client record)
     */
    const customerIds = assignments.map((a) => a.customer_id);

    const { data: customerUsers, error: customersError } = await supabase.schema("portal")
      .from("users")
      .select("id, email, customer_id")
      .in("id", customerIds);

    if (customersError) throw new Error(customersError.message);

    /**
     * 3. Fetch client info (linear_slug, clientName) from the customers table
     */
    const clientIds = customerUsers
      .map((u) => u.customer_id)
      .filter((id): id is string => Boolean(id) && UUID_RE.test(id));

    const { data: clients, error: clientsError } = await supabase.schema("portal")
      .from("customers")
      .select("customer_id, linear_slug, clientName")
      .in("customer_id", clientIds);

    if (clientsError) throw new Error(clientsError.message);

    const clientMap = Object.fromEntries(
      clients.map((c) => [c.customer_id, c]),
    );

    const customerMap = Object.fromEntries(
      customerUsers.map((u) => [u.id, {
        email: u.email,
        linear_slug: clientMap[u.customer_id]?.linear_slug ?? null,
        clientName: clientMap[u.customer_id]?.clientName ?? null,
      }]),
    );

    // 4. Merge and return
    const result = assignments.map((a) => ({
      ...a,
      customer_email: customerMap[a.customer_id]?.email ?? null,
      linear_slug: customerMap[a.customer_id]?.linear_slug ?? null,
      clientName: customerMap[a.customer_id]?.clientName ?? null,
    }));

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};
