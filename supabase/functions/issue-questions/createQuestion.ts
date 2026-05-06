// @ts-nocheck
import { supabase } from "../client.ts";
import { corsHeaders } from "../utils/headers.ts";

export const createQuestion = async (req: Request) => {
  try {
    const body = await req.json();
    const { issue_id, body: questionBody, role, profile_id, email } = body;

    if (!issue_id || !questionBody || !role || !profile_id) {
      return new Response(
        JSON.stringify({ error: "issue_id, body, role, and profile_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (role !== "customer" && role !== "developer") {
      return new Response(
        JSON.stringify({ error: "role must be 'customer' or 'developer'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Resolve assignee IDs from the assignments table based on who is asking
    let assigneeIds: string[] = [];

    if (role === "customer") {
      // Customer is asking → notify all developers assigned to them
      const { data, error } = await supabase
        .from("assignments")
        .select("user_id")
        .eq("customer_id", profile_id);

      if (error) throw new Error(error.message);
      assigneeIds = (data ?? []).map((row: any) => row.user_id).filter(Boolean);
    } else {
      // Developer is asking → notify the customer(s) assigned to them
      const { data, error } = await supabase
        .from("assignments")
        .select("customer_id")
        .eq("user_id", profile_id);

      if (error) throw new Error(error.message);
      assigneeIds = (data ?? []).map((row: any) => row.customer_id).filter(Boolean);
    }

    if (assigneeIds.length === 0) {
      return new Response(
        JSON.stringify({ error: "No assignees found for this user" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Insert one row per assignee
    const rows = assigneeIds.map((assignee_id) => ({
      issue_id,
      body: questionBody,
      creator_id: profile_id,
      assignee_id,
      is_read: false,
    }));

    const { data: inserted, error: insertError } = await supabase
      .from("issue_questions")
      .insert(rows)
      .select();

    if (insertError) throw new Error(insertError.message);

    return new Response(JSON.stringify({ data: inserted }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[createQuestion Error]", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};
