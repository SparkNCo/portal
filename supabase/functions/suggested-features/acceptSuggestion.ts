// @ts-nocheck
import { supabase } from "../client.ts";
import { linearRequest, GET_PROJECT_TEAM_QUERY } from "../issues/linearClient.ts";
import { GET_STATE_ID_QUERY } from "../issues/updateIsste.ts";
import { PRIORITY_MAP, CREATE_ISSUE_MUTATION } from "../issues/createIssue.ts";
import { upsertIssueVector } from "../lib/vector.ts";
import { requireNonDeveloper } from "./authorize.ts";

// POST /suggested-features/accept — { id, priority, actorEmail }. Creates the
// Linear issue (Backlog, no cycle, suggestion's project/milestone, chosen
// priority) and marks the row accepted. Builds its own input instead of using
// handleCreateIssue, which can't set stateId/cycleId.
export async function handleAcceptSuggestion(req: Request): Promise<Response> {
  const schema = "portal";
  const { id, priority, actorEmail } = await req.json();

  if (!id || !priority || !actorEmail) {
    return Response.json({ error: "Missing id, priority, or actorEmail" }, { status: 400 });
  }
  if (!(priority in PRIORITY_MAP)) {
    return Response.json(
      { error: "priority must be one of low, medium, high, urgent" },
      { status: 400 },
    );
  }

  const authError = await requireNonDeveloper(schema, actorEmail);
  if (authError) return authError;

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
    // Explicit null. A team's "auto-add to active cycle" setting can still override it.
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

  // Best-effort: makes the new ticket searchable right away.
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
