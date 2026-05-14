// @ts-nocheck
import { supabase } from "../client.ts";
import { corsHeaders, LINEAR_GRAPHQL } from "../utils/headers.ts";

const CREATE_COMMENT_MUTATION = `
  mutation CommentCreate($input: CommentCreateInput!) {
    commentCreate(input: $input) {
      success
      comment { id }
    }
  }
`;

async function getUserLinearToken(profileId: string): Promise<string> {
  const { data } = await supabase
    .from("users")
    .select("linear_access_token")
    .eq("id", profileId)
    .maybeSingle();
  return data?.linear_access_token ?? Deno.env.get("LINEAR_API_KEY")!;
}

async function postLinearComment(issueId: string, body: string, token: string): Promise<void> {
  const res = await fetch(LINEAR_GRAPHQL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: token,
    },
    body: JSON.stringify({
      query: CREATE_COMMENT_MUTATION,
      variables: { input: { issueId, body } },
    }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
}

export const createQuestion = async (req: Request) => {
  try {
    const body = await req.json();
    const { issue_id, body: questionBody, role, profile_id } = body;

    if (!issue_id || !questionBody || !role || !profile_id) {
      return new Response(
        JSON.stringify({ error: "issue_id, body, role, and profile_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (role !== "customer" && role !== "developer" && role !== "stakeholder") {
      return new Response(
        JSON.stringify({ error: "role must be 'customer', 'developer', or 'stakeholder'" }),
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
        .eq("customer_id", profile_id)
        .eq("role", "developer");

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

    const token = await getUserLinearToken(profile_id);
    await postLinearComment(issue_id, questionBody, token);

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
