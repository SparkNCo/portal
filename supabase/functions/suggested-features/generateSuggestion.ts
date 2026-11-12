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
  state?: { name: string; type?: string | null } | null;
  projectMilestone?: { id: string } | null;
};
type ContextProject = {
  id: string;
  name: string;
  description?: string | null;
  content?: string | null;
  completedAt?: string | null;
  canceledAt?: string | null;
  status?: { type?: string | null } | null;
};
type ContextInitiative = { name: string; description?: string | null } | null;

// Long texts are cut so one verbose project can't flood the prompt.
const MAX_INITIATIVE_CHARS = 1500;
const MAX_PROJECT_CHARS = 3000;
// Tickets listed per group (open / completed / canceled).
const MAX_TICKETS_PER_GROUP = 50;

const clip = (text: string | null | undefined, max: number) => {
  const trimmed = (text ?? "").trim();
  return trimmed.length > max ? `${trimmed.slice(0, max)}…` : trimmed;
};

// A finished project gets no suggestions: completed or canceled, by its
// status or its completion dates.
export function isProjectClosed(project: ContextProject): boolean {
  const type = project.status?.type ?? "";
  return !!project.completedAt || !!project.canceledAt || type === "completed" || type === "canceled";
}

// Linear's workflow state types: backlog / unstarted / started are open,
// completed is done, canceled (and duplicate) was dropped.
function groupIssues(issues: ContextIssue[]) {
  const done: ContextIssue[] = [];
  const dropped: ContextIssue[] = [];
  const open: ContextIssue[] = [];
  for (const issue of issues) {
    const type = issue.state?.type ?? "";
    if (type === "completed") done.push(issue);
    else if (type === "canceled" || type === "duplicate") dropped.push(issue);
    else open.push(issue);
  }
  return { open, done, dropped };
}

const issueLines = (issues: ContextIssue[], empty: string) =>
  issues.length
    ? issues
        .slice(0, MAX_TICKETS_PER_GROUP)
        .map(
          (i) =>
            `- ${i.title} [${i.state?.name ?? "Unknown"}]` +
            (i.priorityLabel && i.priorityLabel !== "No priority" ? ` (priority: ${i.priorityLabel})` : ""),
        )
        .join("\n")
    : empty;

export function buildPrompt(
  initiative: ContextInitiative,
  project: ContextProject,
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

  const { open, done, dropped } = groupIssues(issues);
  const initiativeText = initiative
    ? `Name: ${initiative.name}\n${clip(initiative.description, MAX_INITIATIVE_CHARS) || "(no description)"}`
    : "(not available)";
  const projectDetails = [clip(project.description, 500), clip(project.content, MAX_PROJECT_CHARS)]
    .filter(Boolean)
    .join("\n\n");

  return `You are a product-minded software consultant proposing the next feature to build for a client's software product. Use all the context below: the product as a whole, this project's specifics, and what has already been built or planned.

THE PRODUCT (the client's initiative in Linear — what the whole product is):
${initiativeText}

THIS PROJECT (the part of the product the feature goes in):
Name: ${project.name}
${projectDetails || "(no description)"}

Milestones in this project:
${milestonesText}

Open tickets in this project (already planned or in progress — don't suggest these again):
${issueLines(open, "(none)")}

Completed tickets in this project (already built — don't suggest these again):
${issueLines(done, "(none)")}

Canceled tickets in this project (the client decided against them — don't suggest these again):
${issueLines(dropped, "(none)")}

Suggest exactly ONE new feature that would be a valuable next step for this project, consistent with what the product is for. It must not duplicate or closely overlap any ticket listed above, open, completed or canceled.

Respond with:
- "title": a short, clear feature title, written like a ticket title (not a sentence)
- "description": 2-4 sentences explaining what the feature is and why it's valuable, grounded in the product and project context above
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

// Thrown for a project that's done: no suggestion is created under it.
export class ClosedProjectError extends Error {
  constructor(projectName: string) {
    super(`"${projectName}" is already done, so it gets no suggested features.`);
    this.name = "ClosedProjectError";
  }
}

// Linear context → AI → insert, for one project. Shared by /generate and the
// weekly cron. `linearSlug` must already be resolved by the caller: it's the
// customer's initiative id, so the prompt also gets the whole product.
export async function generateSuggestionForProject(
  schema: string,
  linearSlug: string,
  projectId: string,
) {
  const data = await linearRequest(PROJECT_CONTEXT_QUERY, { projectId, initiativeId: linearSlug });
  const project = data?.project;
  if (!project) {
    throw new Error(`Project ${projectId} not found in Linear`);
  }
  if (isProjectClosed(project)) {
    throw new ClosedProjectError(project.name);
  }

  const milestones: Milestone[] = project.projectMilestones?.nodes ?? [];
  const issues: ContextIssue[] = project.issues?.nodes ?? [];

  const suggestion = await generateWithAI(buildPrompt(data?.initiative ?? null, project, milestones, issues));
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

  try {
    const row = await generateSuggestionForProject(schema, linearSlug, projectId);
    return Response.json(row);
  } catch (err) {
    if (err instanceof ClosedProjectError) {
      return Response.json({ error: err.message }, { status: 409 });
    }
    throw err;
  }
}
