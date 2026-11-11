// Scores a finished Building / MVP / Scaling run: per-area and overall
// readiness, critical flags, blind spots and the offer to show.
// Rules: TECHNICAL_REVIEW_FLOW.md section 10.
import { AREA_LABELS, CHECKS, OWNERSHIP_CHECKS, childrenMayUse, isLargeUserBase } from "./catalog.ts";
import { CONFIG } from "./config.ts";
import { planQuestionIds } from "./plan.ts";
import type {
  AnswerValue,
  Answers,
  AreaId,
  AreaResult,
  Context,
  CriticalFlag,
  Offer,
  Plan,
  Result,
  TechStage,
  Topic,
} from "./types.ts";

const CHECK_POINTS: Record<string, number> = { yes: 2, unsure: 1, no: 0 };

// Points for one answer, or null when it doesn't count (unanswered, or an
// option scored as "excluded", like SOC 2 "Not yet asked").
export function points(id: string, answer: AnswerValue | undefined): number | null {
  if (typeof answer !== "string") return null;
  const options = CHECKS[id]?.options;
  if (options) return options.find((o) => o.value === answer)?.score ?? null;
  return CHECK_POINTS[answer] ?? null;
}

// Topics that count more for this product (assumption #11 for the factor).
export function boostedTopics(ctx: Context, plan: Plan): Set<Topic> {
  const boosted = new Set<Topic>();
  if (ctx.features.includes("payments") || ctx.features.includes("personal_data")) {
    boosted.add("security").add("backups").add("privacy");
  }
  const moduleIds = new Set(plan.modules.map((m) => m.id));
  if (moduleIds.has("healthcare") || moduleIds.has("fintech") || childrenMayUse(ctx)) boosted.add("privacy");
  if (isLargeUserBase(ctx)) boosted.add("scale");
  return boosted;
}

const isNotYes = (v: AnswerValue | undefined) => v === "no" || v === "unsure";

export function criticalFlags(ctx: Context, plan: Plan, answers: Answers): CriticalFlag[] {
  const asked = new Set(planQuestionIds(plan));
  const a = (id: string) => (asked.has(id) || OWNERSHIP_CHECKS.includes(id) ? answers[id] : undefined);
  const { stage } = ctx;
  const early = stage === "building" || stage === "mvp";
  const later = stage === "mvp" || stage === "scaling";
  const usedAiBuilder = ctx.aiTools.some((t) => t !== "none");
  const flags: CriticalFlag[] = [];
  const flag = (when: boolean, id: string, title: string) => {
    if (when) flags.push({ id, title });
  };

  flag(early && isNotYes(a("access_control")), "data_isolation", "Not checked that users can't see each other's data");
  flag(early && usedAiBuilder && isNotYes(a("secrets_audit")), "exposed_secrets", "Secrets not checked, and an AI build tool was used");
  flag(
    stage === "building" ? isNotYes(a("backups")) : isNotYes(a("backup_restore")),
    "backups",
    stage === "building" ? "Automatic backups not switched on" : "Restoring from backup hasn't been tested",
  );
  flag(
    ["ai_platform_only", "not_sure"].includes(String(a("t3_code_control") ?? "")) || a("t3_accounts_owned") === "no",
    "ownership",
    "The company doesn't fully own and control its code, hosting or domain",
  );
  flag(ctx.features.includes("payments") && isNotYes(a("idempotency")), "double_charge", "Takes payments with no protection against charging twice");
  flag(later && a("mfa_infra") === "no", "no_mfa", "No two-step login on the accounts that control the product");
  flag(stage === "scaling" && isNotYes(a("no_spof")), "single_point_of_failure", "One failing part could take everything down");
  flag(isNotYes(a("hc_baa")), "health_baa", "Services handling US health data have no BAAs");
  flag(isNotYes(a("edu_parental_consent")), "children_consent", "Children could use it and there's no parental consent");
  flag(later && a("ent_rbac") === "no", "enterprise_permissions", "Enterprise customers can't control their staff's permissions");
  flag(
    stage === "mvp" && isLargeUserBase(ctx) && (isNotYes(a("load_testing")) || isNotYes(a("autoscaling"))),
    "scale_readiness",
    "10,000+ users with no load testing or auto-scaling",
  );
  return flags;
}

export function chooseOffer(stage: TechStage, flags: CriticalFlag[], blindSpotAreas: number, overall: number): Offer {
  const needsReview = flags.length > 0 || blindSpotAreas >= CONFIG.blindSpotAreasForReview;
  switch (stage) {
    case "building":
      return flags.length > 0
        ? { primary: "prelaunch_repo_review", secondary: ["free_consult"] }
        : { primary: "free_consult", secondary: ["prelaunch_repo_review"] };
    case "mvp":
      return needsReview
        ? { primary: "repo_review", secondary: ["free_consult"] }
        : { primary: "free_consult", secondary: ["repo_review"] };
    case "scaling":
      if (needsReview) return { primary: "repo_architecture_review", secondary: ["free_consult"] };
      if (overall >= CONFIG.scalingHighScore) return { primary: "next_stage_consult", secondary: [] };
      // Not covered by the spec (assumption #12).
      return { primary: "free_consult", secondary: ["repo_architecture_review"] };
  }
}

export function scoreRun(ctx: Context, plan: Plan, answers: Answers): Result {
  const boosted = boostedTopics(ctx, plan);
  const scored: { id: string; area: AreaId }[] = [
    ...OWNERSHIP_CHECKS.map((id) => ({ id, area: "ownership" as AreaId })),
    ...plan.sections.flatMap((s) => s.questions.map((q) => ({ id: q.id, area: q.area }))),
  ];

  const byArea = new Map<AreaId, { got: number; max: number; unsure: number; answered: number }>();
  let got = 0;
  let max = 0;

  for (const { id, area } of scored) {
    const p = points(id, answers[id]);
    if (p === null) continue;
    const topic = CHECKS[id]?.topic ?? "general";
    const weight = boosted.has(topic) ? CONFIG.boostWeight : 1;
    const bucket = byArea.get(area) ?? { got: 0, max: 0, unsure: 0, answered: 0 };
    bucket.got += p * weight;
    bucket.max += 2 * weight;
    bucket.answered += 1;
    if (answers[id] === "unsure") bucket.unsure += 1;
    byArea.set(area, bucket);
    got += p * weight;
    max += 2 * weight;
  }

  const areas: AreaResult[] = [...byArea.entries()].map(([area, b]) => {
    const score = b.max ? Math.round((b.got / b.max) * 100) : 0;
    const status =
      b.unsure >= CONFIG.blindSpotUnsure ? "blind_spot" : score >= CONFIG.goodAreaScore ? "good" : "gap";
    return { area, label: AREA_LABELS[area], score, status, unsure: b.unsure, answered: b.answered };
  });

  const overall = max ? Math.round((got / max) * 100) : 0;
  const flags = criticalFlags(ctx, plan, answers);
  const blindSpots = areas.filter((a) => a.status === "blind_spot").map((a) => a.area);

  return {
    stage: ctx.stage,
    overall,
    areas,
    flags,
    blindSpots,
    offer: chooseOffer(ctx.stage, flags, blindSpots.length, overall),
    complianceAsked: plan.complianceAsked,
  };
}
