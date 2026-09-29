// @ts-nocheck
import { supabase } from "../client.ts";
import { linearRequest } from "../issues/linearClient.ts";
import { GET_PROJECTS_BY_IDS_QUERY } from "../issues/updateIsste.ts";
import { requireNonDeveloper } from "./authorize.ts";

// PATCH /suggested-features/project — { id, projectId, actorEmail }.
// projectId must belong to this customer's customers.linear_projects.
// Clears the milestone, since it belonged to the old project.
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

  // project_slug = linear_slug; look up the customer's allowed project ids.
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
