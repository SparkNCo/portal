// Tunable numbers the spec leaves open. These are ASSUMPTIONS until Spark & Co
// confirms them — see "Open questions and assumptions" in
// marketing-site/docs/TECHNICAL_REVIEW_FLOW.md. Change them here only.
import type { ModuleId } from "./types.ts";

export const CONFIG = {
  // At most this many questions added by context modules per run (~8).
  moduleQuestionCap: 8,

  // Module order when the cap cuts: highest risk first. Health, children
  // and finance come first per the spec; the rest is assumption #4.
  modulePriority: [
    "healthcare",
    "children",
    "fintech",
    "government",
    "enterprise",
    "marketplace",
    "region",
    "public",
    "scale",
  ] as ModuleId[],

  // Question weight multiplier when its topic is boosted (assumption #11).
  boostWeight: 1.5,

  // An area with this many Unsure answers is a "Blind spot".
  blindSpotUnsure: 2,

  // Area score (0–100) at or above this is "Good", below is "Gap" (#11).
  goodAreaScore: 75,

  // Scaling: overall score at or above this, with no flags and fewer than
  // `blindSpotAreasForReview` blind spots, gets the congratulations (#11).
  scalingHighScore: 80,

  // MVP / Scaling: this many blind-spot areas switch the offer to a review.
  blindSpotAreasForReview: 2,
} as const;
