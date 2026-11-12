// Idea branch: rule-based gaps in thinking. Used when the AI gap analysis is
// unavailable or slow, so everyone still gets 3 gaps that reference their
// own answers. Rules: TECHNICAL_REVIEW_FLOW.md section 9.
import { IDEA_QUESTIONS, SCOPE, aboutQuestions } from "./catalog.ts";
import { isShown } from "./conditions.ts";
import type { Answers, Question } from "./types.ts";

// "What you told us": every answered question, with option labels.
export function ideaPlayback(answers: Answers): { label: string; value: string }[] {
  const questions: Question[] = [...aboutQuestions("idea"), ...SCOPE, ...IDEA_QUESTIONS.flatMap((g) => g.questions)];
  const out: { label: string; value: string }[] = [];
  for (const q of questions) {
    const raw = answers[q.id];
    if (raw === undefined || raw === "" || (Array.isArray(raw) && raw.length === 0) || !isShown(q, answers)) continue;
    const labelOf = (v: string) => q.options?.find((o) => o.value === v)?.label ?? v;
    const value = Array.isArray(raw) ? raw.map(labelOf).join(", ") : labelOf(raw);
    out.push({ label: q.text, value });
  }
  return out;
}

export type IdeaGap = { title: string; explanation: string; nextStep: string };

const list = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : v ? [String(v)] : []);
const text = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

// Must-haves written as lines, bullets or commas.
export function countMustHaves(value: unknown): number {
  return text(value)
    .split(/\n|,|;|•/)
    .map((s) => s.replace(/^[-*\d.)\s]+/, "").trim())
    .filter(Boolean).length;
}

// "What you told us" as a product card: the description, the scope as tags,
// and each answer as a short row marked good / worth a look / neutral.
export type ProfileRow = { id: string; label: string; value: string; tone: "good" | "warn" | "neutral" };
export type IdeaProfile = { product: string; audience: string; tags: string[]; rows: ProfileRow[] };

export function ideaProfile(answers: Answers): IdeaProfile {
  const all: Question[] = [...SCOPE, ...IDEA_QUESTIONS.flatMap((g) => g.questions)];
  const labelOf = (id: string, v: string) => all.find((q) => q.id === id)?.options?.find((o) => o.value === v)?.label ?? v;
  const labels = (id: string) => list(answers[id]).map((v) => labelOf(id, v));
  const one = (id: string) => (text(answers[id]) ? labelOf(id, text(answers[id])) : "");

  const tags = [one("scope_industry"), ...labels("scope_users"), one("scope_scale") && `${one("scope_scale")} users`, ...labels("scope_region")].filter(
    Boolean,
  );

  const rows: ProfileRow[] = [];
  const row = (id: string, label: string, value: string, tone: ProfileRow["tone"] = "neutral") => {
    if (value) rows.push({ id, label, value, tone });
  };

  const talked = text(answers.i1_talked);
  row("i1_talked", "Talked to users", one("i1_talked"), talked === "not_yet" ? "warn" : talked === "yes_10" ? "good" : "neutral");
  if (talked && talked !== "not_yet") row("i1_needs", "What they need most", text(answers.i1_needs));

  const looked = text(answers.i2_looked);
  row("i2_looked", "Existing tools", one("i2_looked"), looked === "none_fit" ? "good" : looked ? "warn" : "neutral");
  if (looked === "partly_fit") row("i2_missing", "What's missing from them", text(answers.i2_missing));

  row("i3_who", "Who'll use it", one("i3_who"));
  const plan = text(answers.i3_plan);
  row(
    "i3_plan",
    answers.i3_who === "internal" ? "Rollout plan" : "Go-to-market plan",
    one("i3_plan"),
    plan === "yes" ? "good" : plan === "not_yet" ? "warn" : "neutral",
  );

  const depends = text(answers.i4_depends);
  row("i4_depends", "Depends on other systems", depends === "yes" && text(answers.i4_names) ? `Yes — ${text(answers.i4_names)}` : one("i4_depends"));

  const blockers = labels("i5_blockers").filter((b) => b !== "Other");
  if (text(answers.i5_other)) blockers.push(text(answers.i5_other));
  row("i5_blockers", "What's held you back", blockers.join(", "));

  const must = countMustHaves(answers.i6_must);
  row("i6_must", "Must-have features", must ? `${must} feature${must === 1 ? "" : "s"}` : "", must > 7 ? "warn" : must > 0 ? "good" : "neutral");
  row("i6_nice", "Nice to have", text(answers.i6_nice) ? `${countMustHaves(answers.i6_nice)} more for later` : "");

  const build = labels("i7_build");
  const mismatch = list(answers.i5_blockers).includes("how_to_build") && list(answers.i7_build).includes("ai_tools");
  row("i7_build", "How you'll build it", build.join(", "), mismatch ? "warn" : "neutral");

  return { product: text(answers.about_product), audience: text(answers.about_audience), tags, rows };
}

export function ruleBasedIdeaGaps(answers: Answers): IdeaGap[] {
  const gaps: IdeaGap[] = [];
  const add = (when: boolean, gap: IdeaGap) => {
    if (when) gaps.push(gap);
  };
  const audience = text(answers.about_audience) || "your target users";
  const industry = text(answers.scope_industry);
  const blockers = list(answers.i5_blockers);
  const build = list(answers.i7_build);
  const mustHaves = countMustHaves(answers.i6_must);

  add(answers.i1_talked === "not_yet", {
    title: "Building before talking to users",
    explanation: `You haven't talked to ${audience} about this problem yet.`,
    nextStep: "Have five short conversations about how they handle the problem today before writing any code.",
  });
  add(answers.i2_looked === "not_yet", {
    title: "Existing tools not checked",
    explanation: "You haven't looked at tools that might already solve this.",
    nextStep: "Spend an hour listing three existing tools and what each one gets wrong for your users.",
  });
  add(answers.i2_looked === "partly_fit", {
    title: "Buying or configuring may be enough",
    explanation: `Some existing tools partly fit${text(answers.i2_missing) ? ` — what's missing: "${text(answers.i2_missing)}"` : ""}.`,
    nextStep: "Check whether configuring or extending one of them covers the gap before building from scratch.",
  });
  add(answers.i3_plan === "not_yet", {
    title: answers.i3_who === "internal" ? "No rollout plan" : "No go-to-market plan",
    explanation: "You don't have a plan yet to get it into people's hands.",
    nextStep:
      answers.i3_who === "internal"
        ? "Pick the first team to use it, a launch date, and who will train them."
        : "Pick one channel where your first 20 users already spend time and plan how you'll reach them.",
  });
  add(answers.i4_depends === "yes" && (industry === "healthcare" || industry === "fintech" || industry === "insurance"), {
    title: "Integrations in a regulated industry",
    explanation: `It depends on other systems${text(answers.i4_names) ? ` (${text(answers.i4_names)})` : ""}, and access in your industry can be slow or restricted.`,
    nextStep: "Confirm access, cost and approval time for each integration before committing to a launch date.",
  });
  add(mustHaves > 7, {
    title: "Must-have list too long for a first version",
    explanation: `You listed ${mustHaves} must-have features.`,
    nextStep: "Cut it to the 3–5 features without which nobody would use it, and move the rest to later.",
  });
  add(blockers.includes("how_to_build") && build.includes("ai_tools"), {
    title: "Build route doesn't match the blocker",
    explanation: "You're not sure how to build it, but plan to build it yourself with AI tools.",
    nextStep: "Get a technical plan reviewed before you start, so the AI tools are pointed in the right direction.",
  });
  add(industry === "healthcare", {
    title: "Patient data rules",
    explanation: "Healthcare products usually handle health data with legal protections.",
    nextStep: "Check which rules apply (e.g. HIPAA in the US) before choosing hosting and AI providers.",
  });
  add(industry === "fintech" || industry === "insurance", {
    title: "Payments and identity checks",
    explanation: "Financial products usually need licences, identity checks (KYC) or a specialist payments partner.",
    nextStep: "List which regulations apply and which specialist providers can carry them for you.",
  });

  // Always three, even with few gaps.
  const fallbacks: IdeaGap[] = [
    {
      title: "Success not defined yet",
      explanation: "It's not clear yet how you'll know the first version worked.",
      nextStep: "Write down one number that would tell you, three months after launch, that it's working.",
    },
    {
      title: "Riskiest assumption untested",
      explanation: "Every idea rests on one assumption that, if wrong, sinks it.",
      nextStep: "Name that assumption and find the cheapest way to test it this week.",
    },
    {
      title: "Budget and timeline",
      explanation: "Scope, budget and timeline need to agree before building starts.",
      nextStep: "Set a budget range and a date for the first version, then trim scope to fit.",
    },
  ];
  for (const f of fallbacks) if (gaps.length < 3) gaps.push(f);
  return gaps.slice(0, 3);
}
