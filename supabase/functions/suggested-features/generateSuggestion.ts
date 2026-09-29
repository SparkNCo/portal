// @ts-nocheck
import { supabase } from "../client.ts";
import { linearRequest } from "../issues/linearClient.ts";
import { PROJECT_CONTEXT_QUERY } from "./query.ts";
import { resolveLinearSlug } from "../utils/slug.ts";
import { requestJson } from "../lib/aiClient.ts";

type Milestone = { id: string; name: string; description?: string | null; status: string };
type ContextIssue = {
  title: string;
  priorityLabel?: string | null;
  state?: { name: string } | null;
  projectMilestone?: { id: string } | null;
};

function buildPrompt(
  project: { name: string; description?: string | null },
  milestones: Milestone[],
  issues: ContextIssue[],
): string {
  const milestonesText = milestones.length
    ? milestones
        .map(
          (m) =>
            `- id: ${m.id} | name: ${m.name} | status: ${m.status}` +
            (m.description ? ` | description: ${m.description}` : ""),
        )
        .join("\n")
    : "(this project has no milestones yet)";

  // Capped below the 100 fetched to keep the prompt small.
  const issuesText = issues.length
    ? issues
        .slice(0, 80)
        .map(
          (i) =>
            `- [${i.state?.name ?? "Unknown"}] ${i.title}` +
            (i.priorityLabel ? ` (priority: ${i.priorityLabel})` : ""),
        )
        .join("\n")
    : "(this project has no tickets yet)";

  return `You are a product-minded software consultant proposing the next feature to build for a client's software project, based only on their existing Linear project/milestone/ticket history below.

Project: ${project.name}
${project.description ? `Project description: ${project.description}\n` : ""}
Milestones in this project:
${milestonesText}

Existing tickets in this project (title and current status):
${issuesText}

Suggest exactly ONE new feature that would be a valuable next step for this project. It must not duplicate any existing ticket listed above.

Respond with:
- "title": a short, clear feature title, written like a ticket title (not a sentence)
- "description": 2-4 sentences explaining what the feature is and why it's valuable, grounded in the project/milestone/ticket context above
- "milestoneId": the "id" of whichever milestone listed above this feature best belongs to, or null if none of them fit (or there are no milestones)`;
}

// Model comes from AI_MODEL (lib/aiClient.ts). If suggestion quality is weak,
// pick a more capable model rather than the cheapest.
function generateWithAI(prompt: string): Promise<{
  title: string;
  description: string;
  milestoneId: string | null;
}> {
  return requestJson(prompt, {
    name: "suggested_feature",
    schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        description: { type: "string" },
        milestoneId: { type: ["string", "null"] },
      },
      required: ["title", "description", "milestoneId"],
      additionalProperties: false,
    },
  });
}

// Linear context → AI → insert, for one project. Shared by /generate and the
// weekly cron. `linearSlug` must already be resolved by the caller.
export async function generateSuggestionForProject(
  schema: string,
  linearSlug: string,
  projectId: string,
) {
  const data = await linearRequest(PROJECT_CONTEXT_QUERY, { projectId });
  const project = data?.project;
  if (!project) {
    throw new Error(`Project ${projectId} not found in Linear`);
  }

  const milestones: Milestone[] = project.projectMilestones?.nodes ?? [];
  const issues: ContextIssue[] = project.issues?.nodes ?? [];

  const suggestion = await generateWithAI(buildPrompt(project, milestones, issues));
  const matchedMilestone = milestones.find((m) => m.id === suggestion.milestoneId) ?? null;

  const { data: row, error } = await supabase
    .schema(schema)
    .from("suggested_features")
    .insert({
      project_slug: linearSlug,
      linear_project_id: project.id,
      linear_project_name: project.name,
      linear_milestone_id: matchedMilestone?.id ?? null,
      linear_milestone_name: matchedMilestone?.name ?? null,
      title: suggestion.title,
      description: suggestion.description,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  return row;
}

// POST /suggested-features/generate — manual, one project: { slug, projectId }.
// `slug` is the route slug; resolved server-side to customers.linear_slug —
// never accept a linear_slug from the client.
export async function handleGenerateSuggestion(req: Request): Promise<Response> {
  const schema = "portal";
  const { slug, projectId } = await req.json();

  if (!slug || !projectId) {
    return Response.json({ error: "Missing slug or projectId" }, { status: 400 });
  }

  const linearSlug = await resolveLinearSlug(schema, slug);
  if (!linearSlug) {
    return Response.json({ error: `No customer found for slug "${slug}"` }, { status: 404 });
  }

  const row = await generateSuggestionForProject(schema, linearSlug, projectId);

  return Response.json(row);
}
