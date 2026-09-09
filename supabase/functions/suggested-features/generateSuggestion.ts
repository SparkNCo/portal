// @ts-nocheck
import { supabase } from "../client.ts";
import { linearRequest } from "../issues/linearClient.ts";
import { PROJECT_CONTEXT_QUERY } from "./query.ts";

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

  // Capped well under the 100 fetched — plenty of signal for the AI without
  // ballooning the prompt on a project with a long history.
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

async function generateWithOpenAI(prompt: string): Promise<{
  title: string;
  description: string;
  milestoneId: string | null;
}> {
  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${Deno.env.get("OPENAI_API_KEY")}`,
    },
    body: JSON.stringify({
      // A more capable model than debounce/analyze-idea.ts's gpt-4.1-mini —
      // that one only classifies booleans, this has to generate a coherent,
      // grounded feature idea from a fair amount of context.
      model: "gpt-4.1",
      input: prompt,
      text: {
        format: {
          type: "json_schema",
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
        },
      },
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`OpenAI error: ${errorText}`);
  }

  const data = await res.json();
  const raw = data.output?.[0]?.content?.[0]?.text;
  if (!raw) throw new Error("OpenAI returned no structured output");
  return JSON.parse(raw);
}

// POST /suggested-features/generate — manual trigger for now (no cron yet, see
// ticket notes), one project at a time: { slug, projectId }.
export async function handleGenerateSuggestion(req: Request): Promise<Response> {
  const schema = "portal";
  const { slug, projectId } = await req.json();

  if (!slug || !projectId) {
    return Response.json({ error: "Missing slug or projectId" }, { status: 400 });
  }
  
  
  const data = await linearRequest(PROJECT_CONTEXT_QUERY, { projectId });
  const project = data?.project;
  if (!project) {
    return Response.json({ error: "Project not found in Linear" }, { status: 404 });
  }

  const milestones: Milestone[] = project.projectMilestones?.nodes ?? [];
  const issues: ContextIssue[] = project.issues?.nodes ?? [];

  const suggestion = await generateWithOpenAI(buildPrompt(project, milestones, issues));
  const matchedMilestone = milestones.find((m) => m.id === suggestion.milestoneId) ?? null;

  const { data: row, error } = await supabase
    .schema(schema)
    .from("suggested_features")
    .insert({
      project_slug: slug,
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

  return Response.json(row);
}
