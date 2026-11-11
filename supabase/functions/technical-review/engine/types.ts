// Technical review (SPA-586) — shared types for the question engine.
// Pure TypeScript, no Deno or Node APIs: the edge function and the unit tests
// both import it. Source of truth for the flow:
// marketing-site/docs/TECHNICAL_REVIEW_FLOW.md (question IDs match it).

export type Stage = "idea" | "building" | "mvp" | "scaling";
export type TechStage = Exclude<Stage, "idea">;

export type CheckAnswer = "yes" | "no" | "unsure";
export type AnswerValue = string | string[];
export type Answers = Record<string, AnswerValue | undefined>;

export type Option = { value: string; label: string };

export type QuestionType =
  | "email"
  | "text" // one line
  | "long_text"
  | "single"
  | "multi"
  | "check"; // Yes / No / Unsure, Yes is good

// A condition on an answer given earlier on the same page or before it. The
// browser evaluates these (see conditions.ts) so in-page follow-ups like
// "(if yes) what did they say?" appear without a round trip.
export type Cond =
  | { q: string; in: string[] } // single answer is one of
  | { q: string; anyOf: string[] } // multi answer includes any of
  | { all: Cond[] }
  | { not: Cond };

export type Question = {
  id: string;
  text: string;
  subtitle?: string; // technical subtitle under the plain question
  type: QuestionType;
  options?: Option[];
  required: boolean;
  placeholder?: string;
  showIf?: Cond;
  // Wording that depends on an earlier answer (first match wins).
  textVariants?: { when: Cond; text: string }[];
  // Idea branch: AI may add examples / placeholders / audience names.
  aiEnrich?: string;
};

export type AreaId =
  | "ownership"
  | "security"
  | "data"
  | "launch"
  | "reliability"
  | "abuse"
  | "privacy"
  | "quality"
  | "visibility"
  | "architecture"
  | "performance"
  | "cost"
  | "compliance"
  | "vendors"
  | "engineering"
  | "ai";

// What a check is about, for weighting (security, backups and privacy count
// more with payments / personal data; scale counts more for big user bases).
export type Topic = "security" | "backups" | "privacy" | "scale" | "general";

export type Feature =
  | "payments"
  | "personal_data"
  | "ai_features"
  | "uploads"
  | "admin"
  | "multi_tenant";

export type CheckDef = {
  id: string;
  // Plain question; a per-stage override where the wording differs.
  text: string;
  textByStage?: Partial<Record<TechStage, string>>;
  subtitle: string;
  topic: Topic;
  // Only asked when T2 "Does your product…" includes this feature.
  requires?: Feature;
  // Answer options other than Yes / No / Unsure, with their score (null =
  // excluded from scoring). Without it: yes 2 · unsure 1 · no 0.
  options?: (Option & { score: number | null })[];
};

// Everything the rules read, from step 4 (scope) and T1–T3 (intake).
export type Context = {
  stage: TechStage;
  industry: string;
  users: string[];
  scale: string;
  region: string[];
  children?: string;
  features: string[];
  aiTools: string[];
  // Modules the AI backup detector added from the free text (only adds).
  aiModules?: { id: ModuleId; reason: string }[];
};

export type ModuleId =
  | "healthcare"
  | "children"
  | "fintech"
  | "government"
  | "enterprise"
  | "marketplace"
  | "region"
  | "public"
  | "scale";

export type PlannedQuestion = Question & {
  area: AreaId;
  module?: ModuleId; // set when a context module added it
};

export type PlanSection = { area: AreaId; label: string; questions: PlannedQuestion[] };

export type Plan = {
  stage: TechStage;
  sections: PlanSection[];
  modules: { id: ModuleId; label: string; source: "rule" | "ai"; reason?: string }[];
  // Module questions cut by the cap: listed on results as "also worth checking".
  overflow: { id: string; text: string; module: ModuleId }[];
  hidden: string[]; // check IDs hidden by context (excluded from scoring)
  complianceAsked: boolean; // results show the "not legal advice" disclaimer
};

export type AreaLabel = "good" | "gap" | "blind_spot";

export type AreaResult = {
  area: AreaId;
  label: string;
  score: number; // 0–100
  status: AreaLabel;
  unsure: number;
  answered: number;
};

export type CriticalFlag = { id: string; title: string };

export type OfferId =
  | "free_consult"
  | "prelaunch_repo_review"
  | "repo_review"
  | "repo_architecture_review"
  | "next_stage_consult";

export type Offer = { primary: OfferId; secondary: OfferId[] };

export type Result = {
  stage: TechStage;
  overall: number; // 0–100, stage-relative
  areas: AreaResult[];
  flags: CriticalFlag[];
  blindSpots: AreaId[];
  offer: Offer;
  complianceAsked: boolean; // show the "not legal advice" disclaimer
};
