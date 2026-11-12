// Technical review (SPA-586) question engine. Pure TypeScript: imported by
// the `technical-review` edge function and by tests/unit/technical-review.spec.ts.
export * from "./types.ts";
export { CONFIG } from "./config.ts";
export {
  AREA_LABELS,
  CHECKS,
  IDEA_QUESTIONS,
  INTAKE,
  INTRO,
  MODULES,
  OWNERSHIP_CHECKS,
  SCOPE,
  STAGE_LAYOUT,
  STAGE_QUESTION,
  aboutQuestions,
} from "./catalog.ts";
export { evalCond, isShown, questionText } from "./conditions.ts";
export { activeModules, buildPlan, contextFromAnswers, hiddenChecks, ownershipQuestions, planQuestionIds } from "./plan.ts";
export { questionnaire } from "./questionnaire.ts";
export { boostedTopics, chooseOffer, criticalFlags, points, scoreRun } from "./scoring.ts";
export { NEXT_STAGE, RISK_LIBRARY, findingsFor, type Finding } from "./findings.ts";
export {
  countMustHaves,
  ideaPlayback,
  ideaProfile,
  ruleBasedIdeaGaps,
  type IdeaGap,
  type IdeaProfile,
  type ProfileRow,
} from "./idea.ts";
export { ALLOWED_ANSWER_IDS, sanitizeAnswers } from "./answers.ts";
export { OFFER_COPY, REPO_REVIEW_SCOPE, ideaInvite, joinList, technicalInvite } from "./offers.ts";
