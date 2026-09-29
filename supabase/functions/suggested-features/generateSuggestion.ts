// @ts-nocheck
import { supabase } from "../client.ts";
import { linearRequest } from "../issues/linearClient.ts";
import { PROJECT_CONTEXT_QUERY } from "./query.ts";
import { resolveLinearSlug } from "../utils/slug.ts";

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

// SPA-509 test: swapped from a direct OpenAI call to Hugging Face's
// Inference Providers router (https://router.huggingface.co/v1/chat/
// completions) — an OpenAI-compatible Chat Completions endpoint that fans
// out to whichever backing provider serves the requested model. Only the
// token lives in an env var; endpoint/model/schema stay hardcoded here on
// purpose (no multi-provider config yet — see the SPA-509 discussion, on
// hold pending confirmation from the team on the direction).
//
// "Qwen/Qwen2.5-Coder-3B-Instruct" — a small, cheap model (live via the
// nscale/featherless-ai providers behind HF's router) chosen to keep this
// test's cost down. Unlike aisuite-js (evaluated for this same ticket), HF's
// router supports response_format.json_schema directly — so this keeps the
// same strict schema-enforced JSON output the old /v1/responses call had, no
// prompt-only JSON parsing needed.
// Trade-off worth watching: this is a *code*-tuned 3B model, not a general
// instruct model — it may write flatter/less grounded feature descriptions
// than a bigger general-purpose model would. Swap the model string below if
// suggestion quality turns out too weak once tested against a real project.
async function generateWithHuggingFace(prompt: string): Promise<{
  title: string;
  description: string;
  milestoneId: string | null;
}> {
  const res = await fetch("https://router.huggingface.co/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${Deno.env.get("HUGGINGFACE_API_KEY")}`,
    },
    body: JSON.stringify({
      model: "Qwen/Qwen2.5-Coder-3B-Instruct",
      messages: [{ role: "user", content: prompt }],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "suggested_feature",
          strict: true,
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
    throw new Error(`Hugging Face error: ${errorText}`);
  }

  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content;
  if (!raw) throw new Error("Hugging Face returned no structured output");
  return JSON.parse(raw);
}

// Does the actual work — Linear context fetch, AI call, insert — for one
// project. Shared by the manual HTTP trigger below and
// generateAllSuggestions.ts's weekly cron loop, so both stay in lockstep
// instead of the cron drifting from whatever the manual endpoint does.
// `linearSlug` is the customer's real `customers.linear_slug`, already
// resolved by the caller — this never re-derives it, since who's allowed to
// resolve clientName -> linear_slug (an HTTP request vs. a cron reading the
// customers row directly) differs between the two callers.
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

  const suggestion = await generateWithHuggingFace(buildPrompt(project, milestones, issues));
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

// POST /suggested-features/generate — manual trigger, one project at a time:
// { slug, projectId }. `slug` is the caller's clientName-based route slug
// (same value every other panel on the Build page already has in hand) —
// resolved here to the customer's linear_slug before it's persisted, same
// pattern as issues/updateIsste.ts and tests/index.ts, so `project_slug`
// lines up with what upsertIssueVector/resolveVectorProvider expect
// downstream in acceptSuggestion.ts, and so listSuggestions.ts can resolve
// the same way on read. Never trust a client-supplied linear_slug directly
// here — it has to come from `customers.linear_slug` itself, or a stale/wrong
// value from the caller silently lands suggestions in the wrong (or no)
// namespace, same bug class as the old portal.tests.project_slug issue.
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
