// @ts-nocheck
import { supabase } from "../client.ts";
import { linearRequest } from "../issues/linearClient.ts";
import { GET_PROJECTS_BY_IDS_QUERY } from "../issues/updateIsste.ts";
import { requireNonDeveloper } from "./authorize.ts";

// PATCH /suggested-features/project — { id, projectId, actorEmail }. Lets an
// admin/customer/stakeholder move a suggestion to a different project within
// the same customer/initiative.
//
// `projectId` is re-validated against that customer's own
// customers.linear_projects — the same scoping handleGetProjects already
// enforces for the project picker's own list — never trust a projectId
// blindly just because it's *a* real Linear project id; it has to actually
// belong to this suggestion's customer.
//
// Clears the milestone when the project changes — a milestone belongs to one
// specific project, so whatever was picked for the old project can't carry
// over. The admin/customer picks a fresh one via the milestone picker
// afterward (same UX as generateSuggestion.ts leaving milestone null when
// the AI doesn't have one that fits).
export async function handleUpdateSuggestionProject(req: Request): Promise<Response> {
  const schema = "portal";
  const { id, projectId, actorEmail } = await req.json();

  if (!id || !projectId || !actorEmail) {
    return Response.json({ error: "Missing id, projectId, or actorEmail" }, { status: 400 });
  }

  const authError = await requireNonDeveloper(schema, actorEmail);
  if (authError) return authError;

  const { data: existing, error: fetchError } = await supabase
    .schema(schema)
    .from("suggested_features")
    .select("project_slug, status")
    .eq("id", id)
    .maybeSingle();

  if (fetchError) throw new Error(fetchError.message);
  if (!existing) {
    return Response.json({ error: "Suggestion not found" }, { status: 404 });
  }
  if (existing.status !== "pending") {
    return Response.json({ error: "Suggestion already resolved" }, { status: 409 });
  }

  // `project_slug` is the customer's linear_slug (see generateSuggestion.ts) —
  // resolve back to that customer's row to get its allowed project ids.
  const { data: customer, error: customerError } = await supabase
    .schema(schema)
    .from("customers")
    .select("linear_projects")
    .ilike("linear_slug", existing.project_slug)
    .maybeSingle();

  if (customerError) throw new Error(customerError.message);
  const allowedProjectIds: string[] = customer?.linear_projects ?? [];
  if (!allowedProjectIds.includes(projectId)) {
    return Response.json(
      { error: "That project doesn't belong to this suggestion's initiative" },
      { status: 400 },
    );
  }

  const data = await linearRequest(GET_PROJECTS_BY_IDS_QUERY, {
    filter: { id: { in: [projectId] } },
  });
  const project = data.projects?.nodes?.[0];
  if (!project) {
    return Response.json({ error: "Project not found in Linear" }, { status: 404 });
  }

  const { data: updated, error } = await supabase
    .schema(schema)
    .from("suggested_features")
    .update({
      linear_project_id: project.id,
      linear_project_name: project.name,
      linear_milestone_id: null,
      linear_milestone_name: null,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(error.message);

  return Response.json(updated);
}
