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
export { activeModules, buildPlan, contextFromAnswers, hiddenChecks, planQuestionIds } from "./plan.ts";
export { boostedTopics, chooseOffer, criticalFlags, points, scoreRun } from "./scoring.ts";
