// @ts-nocheck
import { supabase } from "../client.ts";
import { corsHeaders } from "../utils/headers.ts";

// Marks all questions for a given issue_id + assignee_id as read
export const markRead = async (req: Request) => {
  try {
    const body = await req.json();
    const { issue_id, user_id } = body;

    if (!issue_id || !user_id) {
      return new Response(
        JSON.stringify({ error: "issue_id and user_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { error } = await supabase
      .from("issue_questions")
      .update({ is_read: true })
      .eq("issue_id", issue_id)
      .eq("assignee_id", user_id)
      .eq("is_read", false);

    if (error) throw new Error(error.message);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[markRead Error]", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};
