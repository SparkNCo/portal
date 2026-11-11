// Findings for the results page and report: entries from the risk library
// (stack + gap combinations, owned by Spark & Co — not AI-generated), then
// the plain gaps the person reported. Each has a copy-paste fix prompt and
// says whether it's usually DIY or "bring in an engineer".
//
// PLACEHOLDER CONTENT: the library holds the 5 examples from the spec plus a
// "don't know the stack" entry. Spark & Co owns and extends it.
import { CHECKS } from "./catalog.ts";
import { planQuestionIds } from "./plan.ts";
import type { Answers, Context, Plan, TechStage, Topic } from "./types.ts";

export type Finding = {
  id: string;
  title: string;
  explanation: string;
  whyItMatters: string;
  fixPrompt: string; // copy-paste into Cursor / Lovable / Claude
  engineerNote: string; // when to bring in an engineer
  diy: boolean; // "You can fix this yourself" vs "Where teams bring in an engineer"
};

type LibraryEntry = Finding & {
  stages: TechStage[];
  when: (ctx: Context, answers: Answers) => boolean;
};

const list = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : v ? [String(v)] : []);
const ALL: TechStage[] = ["building", "mvp", "scaling"];

export const RISK_LIBRARY: LibraryEntry[] = [
  {
    id: "ai_builder_supabase_rls",
    stages: ["building", "mvp"],
    when: (ctx, a) =>
      ctx.aiTools.some((t) => t === "lovable" || t === "bolt") &&
      (list(a.t2_stack).includes("supabase") || a.t2_hosting === "supabase") &&
      a.access_control === "unsure",
    title: "Row-level security is often missing in Lovable / Bolt + Supabase builds",
    explanation:
      "These tools create Supabase tables quickly, but often without row-level security policies, so any signed-in user can read every row.",
    whyItMatters: "One user seeing another user's data is the most common and most damaging leak in early products.",
    fixPrompt:
      "List every table in my Supabase project. For each one, tell me whether row-level security is enabled and which policies exist. Then add policies so users can only read and change their own rows, and show me how to test that a second user can't see the first user's data.",
    engineerNote: "Bring in an engineer if data is shared between users or teams, or if you store anything sensitive.",
    diy: false,
  },
  {
    id: "ai_builder_exposed_keys",
    stages: ["building", "mvp"],
    when: (ctx, a) => ctx.aiTools.some((t) => t !== "none") && a.secrets_audit === "no",
    title: "API keys are commonly exposed in front-end code",
    explanation: "AI build tools often place secret keys in code that ships to the browser, where anyone can read them.",
    whyItMatters: "A leaked key can run up bills or give full access to your database or payment account.",
    fixPrompt:
      "Search this codebase for API keys, tokens and passwords. List every one that reaches the browser bundle. Move each secret to a server-side environment variable, call the service from the server instead, and tell me which keys I must rotate now.",
    engineerNote: "Bring in an engineer if a key with write access (database, payments) was ever public.",
    diy: true,
  },
  {
    id: "ai_bill_no_rate_limit",
    stages: ["mvp", "scaling"],
    when: (ctx, a) =>
      (a.t2_hosting === "vercel" || a.t2_hosting === "netlify") &&
      a.rate_limit === "no" &&
      ctx.features.includes("ai_features"),
    title: "One user can run up a large AI bill",
    explanation: "Serverless hosting scales with traffic, so without rate limits a single user or bot can call your AI features thousands of times.",
    whyItMatters: "AI usage is billed per request; one abusive account can cost more than your monthly revenue.",
    fixPrompt:
      "Add rate limiting to every route that calls an AI model: a per-user limit and a per-IP limit, returning 429 when exceeded. Also add a daily spending cap per user and log usage per user so I can see who costs what.",
    engineerNote: "Bring in an engineer if you need limits shared across many servers or regions.",
    diy: true,
  },
  {
    id: "payments_duplicate_webhooks",
    stages: ALL,
    when: (ctx, a) => ctx.features.includes("payments") && a.idempotency === "unsure",
    title: "Duplicate Stripe webhooks can double-process orders",
    explanation: "Payment providers retry webhooks, so the same event can arrive more than once. Without a check, an order is fulfilled or charged twice.",
    whyItMatters: "Double charges mean refunds, chargebacks and lost trust.",
    fixPrompt:
      "Find every payment webhook handler in this codebase. Make each one idempotent: store the event ID, skip events already processed, and use idempotency keys when creating charges. Show me a test that sends the same event twice.",
    engineerNote: "Bring in an engineer if you handle subscriptions, refunds or payouts.",
    diy: false,
  },
  {
    id: "scaling_no_soc2",
    stages: ["scaling"],
    when: (_ctx, a) => a.soc2 === "dont_have",
    title: "Enterprise deals stall in security review",
    explanation: "Customers have asked for a security certification you don't have yet.",
    whyItMatters: "Without SOC 2 or ISO 27001, larger deals wait months or go to a competitor.",
    fixPrompt:
      "Draft a SOC 2 readiness checklist for this product: access control, logging, backups, change management and vendor management. For each item, say what we already have in this codebase and infrastructure and what's missing.",
    engineerNote: "Bring in an engineer (and an auditor) to plan the controls and evidence.",
    diy: false,
  },
  {
    id: "low_codebase_visibility",
    stages: ALL,
    when: (_ctx, a) => a.t2_hosting === "dont_know" || list(a.t2_stack).includes("dont_know"),
    title: "Low visibility of your own codebase",
    explanation: "You weren't sure where the product is hosted or what it's built with.",
    whyItMatters: "If nobody on your side knows this, every fix, audit or handover depends on one person or vendor.",
    fixPrompt:
      "Look at this repository and write a one-page summary: languages and frameworks, where it's deployed, which outside services it uses, where secrets are configured, and how to run it locally.",
    engineerNote: "Bring in an engineer if you can't get access to the code or hosting accounts.",
    diy: false,
  },
];

const WHY_BY_TOPIC: Record<Topic, string> = {
  security: "Security gaps are cheap to close now and very expensive after a breach.",
  backups: "Without working backups, one mistake or outage can lose data for good.",
  privacy: "Privacy gaps can mean fines and lost customer trust.",
  scale: "Scale problems show up all at once, usually on your best day.",
  general: "Small gaps like this add up to outages and slow releases.",
};

// A finding for a check answered No / Unsure that the library doesn't cover.
function gapFinding(id: string, answer: string, stage: TechStage): Finding {
  const def = CHECKS[id]!;
  const text = def.textByStage?.[stage] ?? def.text;
  const engineer = def.topic === "security" || def.topic === "backups" || def.topic === "scale";
  return {
    id: `gap_${id}`,
    title: def.subtitle,
    explanation: `You answered "${answer === "no" ? "No" : "Unsure"}" to: ${text}`,
    whyItMatters: WHY_BY_TOPIC[def.topic],
    fixPrompt: `Review this codebase for ${def.subtitle.toLowerCase()}. Question to answer: "${text}" Explain what's in place, what's missing, and make the smallest safe change to fix it.`,
    engineerNote: engineer
      ? "Teams usually bring in an engineer for this one."
      : "Bring in an engineer if the fix touches several parts of the product.",
    diy: !engineer,
  };
}

// Top findings: library entries first, then "No" gaps, then "Unsure" gaps.
export function findingsFor(ctx: Context, plan: Plan, answers: Answers, max = 5): Finding[] {
  const out: Finding[] = [];
  for (const entry of RISK_LIBRARY) {
    if (entry.stages.includes(ctx.stage) && entry.when(ctx, answers)) {
      const { stages: _s, when: _w, ...finding } = entry;
      out.push(finding);
    }
  }
  const asked = planQuestionIds(plan);
  for (const answer of ["no", "unsure"]) {
    for (const id of asked) {
      if (answers[id] === answer) out.push(gapFinding(id, answer, ctx.stage));
    }
  }
  return out.slice(0, max);
}

// "Coming up at your next stage": what to plan for next.
export const NEXT_STAGE: Record<TechStage, { title: string; items: string[] }> = {
  building: {
    title: "Once users arrive",
    items: [
      "Uptime and error alerts, so you hear about problems before customers do",
      "A quick way to roll back a bad release",
      "Rate limits and cost alerts, so one user or bot can't run up your bill",
    ],
  },
  mvp: {
    title: "As you grow",
    items: [
      "Load testing, so you know how many users you can handle",
      "A written incident plan for when something goes badly wrong",
      "Security certifications (SOC 2 / ISO 27001) that larger customers will ask for",
    ],
  },
  scaling: {
    title: "Your next stage",
    items: [
      "Enterprise readiness: SSO, audit trails and customer data controls",
      "A SOC 2 or ISO 27001 audit",
      "Technical due diligence prep for investors or acquirers",
    ],
  },
};
