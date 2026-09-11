// @ts-nocheck
import { supabase } from "../client.ts";
import { linearRequest, GET_PROJECT_TEAM_QUERY } from "../issues/linearClient.ts";
import { GET_STATE_ID_QUERY } from "../issues/updateIsste.ts";
import { PRIORITY_MAP, CREATE_ISSUE_MUTATION } from "../issues/createIssue.ts";
import { upsertIssueVector } from "../lib/vector.ts";

// POST /suggested-features/accept — { id, priority }. Creates the real Linear
// issue (Backlog, no cycle, the suggestion's project/milestone, the chosen
// priority) and marks the row accepted. Deliberately builds its own
// IssueCreateInput here instead of calling issues/createIssue.ts's
// handleCreateIssue — that helper has no way to force stateId or an explicit
// cycleId, which this flow needs and the regular Feature Request/Bug Report
// flow never has, so extending it wasn't worth the risk to an already-used
// path. It does reuse createIssue.ts's own mutation/priority map and
// linearClient.ts's team lookup, so the actual Linear call stays identical.
export async function handleAcceptSuggestion(req: Request): Promise<Response> {
  const schema = "portal";
  const { id, priority } = await req.json();

  if (!id || !priority) {
    return Response.json({ error: "Missing id or priority" }, { status: 400 });
  }
  if (!(priority in PRIORITY_MAP)) {
    return Response.json(
      { error: "priority must be one of low, medium, high, urgent" },
      { status: 400 },
    );
  }

  const { data: suggestion, error: fetchError } = await supabase
    .schema(schema)
    .from("suggested_features")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (fetchError) throw new Error(fetchError.message);
  if (!suggestion) {
    return Response.json({ error: "Suggestion not found" }, { status: 404 });
  }
  if (suggestion.status !== "pending") {
    return Response.json({ error: "Suggestion already resolved" }, { status: 409 });
  }

  const teamData = await linearRequest(GET_PROJECT_TEAM_QUERY, {
    id: suggestion.linear_project_id,
  });
  const teamId = teamData?.project?.teams?.nodes?.[0]?.id;
  if (!teamId) throw new Error("Could not resolve a Linear team for this project");

  const stateData = await linearRequest(GET_STATE_ID_QUERY, {
    teamId,
    stateName: "Backlog",
  });
  const stateId = stateData?.workflowStates?.nodes?.[0]?.id;
  if (!stateId) throw new Error('Could not resolve a "Backlog" state for this team');

  const input: Record<string, unknown> = {
    title: suggestion.title,
    description: suggestion.description,
    teamId,
    priority: PRIORITY_MAP[priority],
    projectId: suggestion.linear_project_id,
    stateId,
    // Explicit, not just omitted — see this file's own header comment on why
    // this can't be a 100% guarantee (a Linear workspace's own "auto-add to
    // active cycle" team setting can still override it).
    cycleId: null,
  };
  if (suggestion.linear_milestone_id) {
    input.projectMilestoneId = suggestion.linear_milestone_id;
  }

  const createData = await linearRequest(CREATE_ISSUE_MUTATION, { input });
  const issue = createData?.issueCreate?.issue;
  if (!createData?.issueCreate?.success || !issue) {
    throw new Error("Failed to create the Linear issue");
  }

  // Best-effort, same as issues/createIssue.ts's own handleCreateIssue —
  // keeps the new ticket searchable for the similar-issues hint right away.
  await upsertIssueVector(suggestion.project_slug, {
    id: issue.id,
    title: suggestion.title,
    description: suggestion.description,
    kind: "feature",
  });

  const { data: updated, error: updateError } = await supabase
    .schema(schema)
    .from("suggested_features")
    .update({
      status: "accepted",
      priority,
      linear_issue_id: issue.id,
      linear_issue_identifier: issue.identifier,
    })
    .eq("id", id)
    .select()
    .single();

  if (updateError) throw new Error(updateError.message);

  return Response.json(updated);
}
