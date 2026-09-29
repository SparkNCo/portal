// @ts-nocheck
import { supabase } from "../client.ts";
import { linearRequest } from "../issues/linearClient.ts";
import { GET_MILESTONES_QUERY } from "../issues/updateIsste.ts";
import { requireNonDeveloper } from "./authorize.ts";

// PATCH /suggested-features/milestone — { id, milestoneId, actorEmail }.
// Overrides the milestone; null clears it. Validated against the suggestion's project.
export async function handleUpdateSuggestionMilestone(req: Request): Promise<Response> {
  const schema = "portal";
  const { id, milestoneId, actorEmail } = await req.json();

  if (!id || !actorEmail) {
    return Response.json({ error: "Missing id or actorEmail" }, { status: 400 });
  }

  const authError = await requireNonDeveloper(schema, actorEmail);
  if (authError) return authError;

  const { data: existing, error: fetchError } = await supabase
    .schema(schema)
    .from("suggested_features")
    .select("linear_project_id, status")
    .eq("id", id)
    .maybeSingle();

  if (fetchError) throw new Error(fetchError.message);
  if (!existing) {
    return Response.json({ error: "Suggestion not found" }, { status: 404 });
  }
  if (existing.status !== "pending") {
    return Response.json({ error: "Suggestion already resolved" }, { status: 409 });
  }

  let milestoneName: string | null = null;
  if (milestoneId) {
    const data = await linearRequest(GET_MILESTONES_QUERY, {
      projectId: existing.linear_project_id,
    });
    const milestones = data.project?.projectMilestones?.nodes ?? [];
    const match = milestones.find((m: { id: string }) => m.id === milestoneId);
    if (!match) {
      return Response.json(
        { error: "That milestone doesn't belong to this suggestion's project" },
        { status: 400 },
      );
    }
    milestoneName = match.name;
  }

  const { data: updated, error } = await supabase
    .schema(schema)
    .from("suggested_features")
    .update({
      linear_milestone_id: milestoneId ?? null,
      linear_milestone_name: milestoneName,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(error.message);

  return Response.json(updated);
}
