// @ts-nocheck
import { supabase } from "../client.ts";
import { corsHeaders } from "../utils/headers.ts";

// Returns unread questions where the caller is the assignee, grouped by issue_id
export const getQuestions = async (req: Request) => {
  try {
    const url = new URL(req.url);
    const user_id = url.searchParams.get("user_id");
    const unread_only = url.searchParams.get("unread_only") !== "false";

    if (!user_id) {
      return new Response(
        JSON.stringify({ error: "user_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let query = supabase
      .from("issue_questions")
      .select("*")
      .eq("assignee_id", user_id)
      .order("created_at", { ascending: false });

    if (unread_only) {
      query = query.eq("is_read", false);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    // Count per issue_id for badge rendering
    const countByIssue: Record<string, number> = {};
    for (const row of data ?? []) {
      countByIssue[row.issue_id] = (countByIssue[row.issue_id] ?? 0) + 1;
    }

    return new Response(JSON.stringify({ data, countByIssue }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[getQuestions Error]", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};
