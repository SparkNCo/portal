// AGENTS.md for the results page: a file people copy into their repository so
// AI coding agents (Cursor, Claude Code, Codex, Copilot…) know the product's
// context, the rules that matter for it, and the gaps the assessment found.
// Built from the answers only (no AI), so the same answers give the same file.
import { AREA_LABELS, CHECKS, FEATURES, INDUSTRY, INTAKE, REGION, SCALE, USERS, childrenMayUse } from "./catalog.ts";
import { findingsFor } from "./findings.ts";
import type { IdeaGap } from "./idea.ts";
import { planQuestionIds } from "./plan.ts";
import type { Answers, Context, Option, Plan } from "./types.ts";

const list = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : v ? [String(v)] : []);
const text = (v: unknown): string => (typeof v === "string" ? v.trim().replace(/\s+/g, " ") : "");
const labelsOf = (options: Option[] | undefined, values: string[]) =>
  values.map((v) => options?.find((o) => o.value === v)?.label ?? v);
const intakeOptions = (id: string) => INTAKE.find((q) => q.id === id)?.options;

// Short stage names for the context block.
const STAGE_NAME: Record<string, string> = {
  idea: "Idea (not built yet)",
  building: "Building (not yet in users' hands)",
  mvp: "MVP (live with early users)",
  scaling: "Scaling (growing usage, team or customers)",
};

function contextLines(answers: Answers): string[] {
  const lines: string[] = [];
  const add = (label: string, value: string) => {
    if (value) lines.push(`- **${label}:** ${value}`);
  };
  add("Company", text(answers.about_company));
  add("Product", text(answers.about_product));
  add("Built for", text(answers.about_audience));
  add("Stage", STAGE_NAME[text(answers.stage)] ?? "");
  add("Industry", labelsOf(INDUSTRY, list(answers.scope_industry)).join(", "));
  add("Users", labelsOf(USERS, list(answers.scope_users)).join(", "));
  add("Users within 12 months", labelsOf(SCALE, list(answers.scope_scale)).join(", "));
  add("Regions", labelsOf(REGION, list(answers.scope_region)).join(", "));
  if (answers.scope_children === "yes" || answers.scope_children === "not_sure") {
    add("Children under 16", answers.scope_children === "yes" ? "Yes, they may use it" : "Possibly");
  }
  add("Stack", labelsOf(intakeOptions("t2_stack"), list(answers.t2_stack).filter((v) => v !== "dont_know")).join(", "));
  add("Hosting", labelsOf(intakeOptions("t2_hosting"), list(answers.t2_hosting).filter((v) => v !== "dont_know")).join(", "));
  add("The product", labelsOf(FEATURES, list(answers.t2_features).filter((v) => v !== "none")).join("; ").toLowerCase());
  return lines;
}

// Rules that hold for every product, then the ones this context adds.
function rules(answers: Answers, ctx?: Context): string[] {
  const features = new Set(list(answers.t2_features));
  const regions = new Set(list(answers.scope_region));
  const industry = text(answers.scope_industry);
  const out = [
    "Never put secrets, API keys or tokens in client-side code or commit them. Read them from server-side environment variables.",
    "Check authorization on the server for every read and write. Scope queries to the signed-in user (or their organization) and never trust IDs sent by the client.",
    "Validate and sanitize all user input on the server, including query parameters and uploaded content.",
    "Keep changes small and reviewable. Add or update tests when you change business rules, and make sure the build and tests pass before finishing.",
    "Don't add a new dependency or third-party service without saying why, and prefer well-maintained ones.",
  ];
  const add = (when: boolean, rule: string) => {
    if (when) out.push(rule);
  };
  add(features.has("personal_data"), "Collect only personal data with a clear purpose, never write it to logs, and keep a way to export and delete a user's data.");
  add(features.has("payments"), "Make payment and webhook handlers idempotent: store the provider's event ID and skip events already processed. Never trust prices or amounts sent by the client.");
  add(features.has("ai_features"), "Rate-limit every route that calls an AI model (per user and per IP), cap spend per user, and treat model output as untrusted input.");
  add(features.has("uploads"), "Check file type and size on the server, keep uploads in private storage, and serve them through short-lived signed URLs.");
  add(features.has("admin"), "Admin routes and actions must check the admin role on the server. Hiding them in the UI is not enough.");
  add(features.has("multi_tenant"), "Every table with customer data carries the organization ID, and every query filters by it. Add a test that one organization can't read another's data.");
  add(regions.has("eu_uk"), "EU / UK users: follow GDPR. Ask for consent before non-essential tracking and support data export and deletion requests.");
  add(industry === "healthcare", "Health data: only send it to services that have signed a BAA (US) or equivalent, and log who accessed it.");
  add(industry === "fintech" || industry === "insurance", "Financial data: keep card data out of our systems (use the payment provider's hosted fields) and keep an audit trail of money movements.");
  add(!!ctx && childrenMayUse(ctx), "Children may use this product: require parental consent before collecting their data and collect as little as possible.");
  add(list(answers.scope_users).includes("public"), "Public sign-up: protect it against bots (email verification, CAPTCHA or rate limits).");
  return out;
}

// Technical stages: findings with their fix prompts, then what the team
// wasn't sure about.
function gapSections(ctx: Context, plan: Plan, answers: Answers): string[] {
  const out: string[] = [];
  const findings = findingsFor(ctx, plan, answers, 50);
  if (findings.length > 0) {
    out.push("## Known gaps", "", "Found by the assessment. When you work on related code, close these gaps instead of working around them.", "");
    for (const f of findings) {
      out.push(`### ${f.title}`, "", `${f.explanation} ${f.whyItMatters}`, "", `What to do: ${f.fixPrompt}`, "");
    }
  }

  const unsure = planQuestionIds(plan).filter((id) => answers[id] === "unsure");
  if (unsure.length > 0) {
    out.push("## Not verified yet", "", "The team wasn't sure about these. Don't assume they're in place; check the code and say what you find.", "");
    for (const id of unsure) {
      const area = plan.sections.find((s) => s.questions.some((q) => q.id === id));
      const label = area ? (AREA_LABELS[area.area] ?? area.label) : "";
      const prefix = label ? label + ": " : "";
      out.push(`- ${prefix}${CHECKS[id]?.subtitle ?? id}`);
    }
    out.push("");
  }
  return out;
}

function ideaSections(gaps: IdeaGap[]): string[] {
  if (gaps.length === 0) return [];
  const out = ["## Before you build", "", "Open questions from the assessment. Raise them if a request depends on one.", ""];
  for (const g of gaps) out.push(`- **${g.title}.** ${g.explanation} Next step: ${g.nextStep}`);
  out.push("");
  return out;
}

export function agentsMd(input: { answers: Answers; ctx?: Context; plan?: Plan; ideaGaps?: IdeaGap[] }): string {
  const { answers, ctx, plan } = input;
  const lines = [
    "# AGENTS.md",
    "",
    "Guidance for AI coding agents working in this repository. Generated by the Spark & Co assessment (buildwithspark.co/assessment). Edit it as the project changes.",
    "",
  ];
  const context = contextLines(answers);
  if (context.length > 0) lines.push("## Project context", "", ...context, "");
  lines.push("## Rules", "", ...rules(answers, ctx).map((r) => `- ${r}`), "");
  if (ctx && plan) lines.push(...gapSections(ctx, plan, answers));
  else lines.push(...ideaSections(input.ideaGaps ?? []));
  return lines.join("\n").trimEnd() + "\n";
}
