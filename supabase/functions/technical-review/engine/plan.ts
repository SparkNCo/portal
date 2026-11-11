// Builds the ordered question list for Building / MVP / Scaling from the
// scope (step 4) and intake (T1–T3) answers. Same answers → same questions,
// so scores stay comparable. Rules: TECHNICAL_REVIEW_FLOW.md sections 4–8.
import { AREA_LABELS, CHECKS, MODULES, STAGE_LAYOUT, YES_NO_UNSURE, moduleArea, type ModuleDef } from "./catalog.ts";
import { CONFIG } from "./config.ts";
import type { Answers, AreaId, Context, ModuleId, Plan, PlannedQuestion, PlanSection, TechStage } from "./types.ts";

const asList = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : v ? [String(v)] : []);
const asText = (v: unknown): string => (typeof v === "string" ? v : "");

const TECH_STAGES: TechStage[] = ["building", "mvp", "scaling"];

// Reads the rule inputs out of the raw answers. `aiModules` comes from the
// AI backup detector, never from the browser.
export function contextFromAnswers(answers: Answers, aiModules?: Context["aiModules"]): Context {
  const stage = asText(answers.stage) as TechStage;
  if (!TECH_STAGES.includes(stage)) throw new Error(`Not a technical stage: ${answers.stage}`);
  return {
    stage,
    industry: asText(answers.scope_industry),
    users: asList(answers.scope_users),
    scale: asText(answers.scope_scale),
    region: asList(answers.scope_region),
    children: asText(answers.scope_children) || undefined,
    features: asList(answers.t2_features).filter((f) => f !== "none"),
    aiTools: asList(answers.t2_ai_tools),
    aiModules,
  };
}

export const isInternalOnly = (ctx: Context) => ctx.users.length === 1 && ctx.users[0] === "internal";
const BUSINESS_USERS = new Set(["small_business", "enterprise", "internal"]);
const onlyBusinessUsers = (ctx: Context) => ctx.users.length > 0 && ctx.users.every((u) => BUSINESS_USERS.has(u));

// Context modules that apply, highest risk first, and why.
export function activeModules(ctx: Context): { def: ModuleDef; source: "rule" | "ai"; reason?: string }[] {
  const byPriority = [...MODULES].sort(
    (a, b) => CONFIG.modulePriority.indexOf(a.id) - CONFIG.modulePriority.indexOf(b.id),
  );
  const active: { def: ModuleDef; source: "rule" | "ai"; reason?: string }[] = [];
  for (const def of byPriority) {
    if (def.trigger(ctx)) {
      active.push({ def, source: "rule" });
      continue;
    }
    // AI can only add modules (never remove), and only those it may detect.
    const fromAi = def.aiDetectable ? ctx.aiModules?.find((m) => m.id === def.id) : undefined;
    if (fromAi) active.push({ def, source: "ai", reason: fromAi.reason });
  }
  return active;
}

// Questions hidden by context (section 8). Hidden questions are excluded
// from scoring, not scored as zero.
export function hiddenChecks(ctx: Context, moduleIds: Set<ModuleId>): Set<string> {
  const hidden = new Set<string>();
  const hide = (...ids: string[]) => ids.forEach((id) => hidden.add(id));
  const under100 = ctx.scale === "under_100";

  if (isInternalOnly(ctx)) {
    hide("consent", "reg_ccpa", "pub_bot_protection", "pub_ugc_moderation");
    // Applies to Scaling's core checks too (assumption #6).
    if (under100) hide("load_testing", "autoscaling", "cdn", "product_analytics");
  }
  if (onlyBusinessUsers(ctx)) hide("edu_parental_consent", "edu_age_check");
  if (under100 && ctx.stage !== "scaling") hide("autoscaling", "cdn");
  if (!ctx.region.includes("eu_uk") && !moduleIds.has("enterprise") && !moduleIds.has("government")) {
    hide("data_residency");
  }
  return hidden;
}

function toQuestion(id: string, stage: TechStage, area: AreaId, module?: ModuleId): PlannedQuestion {
  const def = CHECKS[id];
  if (!def) throw new Error(`Unknown check: ${id}`);
  return {
    id,
    text: def.textByStage?.[stage] ?? def.text,
    subtitle: def.subtitle,
    type: def.options ? "single" : "check",
    options: def.options?.map(({ value, label }) => ({ value, label })) ?? YES_NO_UNSURE,
    required: true,
    area,
    ...(module && { module }),
  };
}

export function buildPlan(ctx: Context): Plan {
  const { stage } = ctx;
  const features = new Set(ctx.features);
  const applies = (id: string) => {
    const requires = CHECKS[id]?.requires;
    return !requires || features.has(requires);
  };

  const modules = activeModules(ctx);
  const hidden = hiddenChecks(ctx, new Set(modules.map((m) => m.def.id)));
  const hiddenAsked = new Set<string>();

  // 1. Core checks for the stage, minus feature conditions and hidden ones.
  const sections: PlanSection[] = STAGE_LAYOUT[stage].map(({ area, label }) => ({
    area,
    label: label ?? AREA_LABELS[area],
    questions: [],
  }));
  const sectionOf = (area: AreaId) => {
    const section = sections.find((s) => s.area === area);
    if (!section) throw new Error(`No ${area} area in ${stage}`);
    return section;
  };
  const present = new Set<string>();

  for (const { area, checks } of STAGE_LAYOUT[stage]) {
    for (const id of checks) {
      if (!applies(id)) continue;
      if (hidden.has(id)) {
        hiddenAsked.add(id);
        continue;
      }
      sectionOf(area).questions.push(toQuestion(id, stage, area));
      present.add(id);
    }
  }

  // 2. Module questions, highest-risk module first, deduped, up to the cap.
  let budget: number = CONFIG.moduleQuestionCap;
  let complianceAsked = false;
  const overflow: Plan["overflow"] = [];

  for (const { def } of modules) {
    for (const q of def.questions) {
      if (!q.stages.includes(stage)) continue;
      if (q.when && !q.when(ctx)) continue;
      if (!applies(q.id) || present.has(q.id)) continue;
      if (hidden.has(q.id)) {
        hiddenAsked.add(q.id);
        continue;
      }
      if (budget <= 0) {
        overflow.push({ id: q.id, text: CHECKS[q.id]?.text ?? q.id, module: def.id });
        continue;
      }
      const area = moduleArea(stage, q.kind);
      sectionOf(area).questions.push(toQuestion(q.id, stage, area, def.id));
      present.add(q.id);
      if (q.kind === "compliance") complianceAsked = true;
      budget--;
    }
  }

  return {
    stage,
    sections: sections.filter((s) => s.questions.length > 0),
    modules: modules.map(({ def, source, reason }) => ({
      id: def.id,
      label: def.label,
      source,
      ...(reason && { reason }),
    })),
    overflow,
    hidden: [...hiddenAsked],
    complianceAsked,
  };
}

export function planQuestionIds(plan: Plan): string[] {
  return plan.sections.flatMap((s) => s.questions.map((q) => q.id));
}
