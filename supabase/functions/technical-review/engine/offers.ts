// Offer copy and the personalized invite (names blind spots / blockers).
import { AREA_LABELS, IDEA_QUESTIONS } from "./catalog.ts";
import type { Answers, OfferId, Result } from "./types.ts";

// Stated on the page wherever a repo review is offered.
export const REPO_REVIEW_SCOPE =
  "A 30-minute review of your top 3 risks. Read-only access, revoked afterwards. Written summary delivered.";

export const OFFER_COPY: Record<OfferId, { title: string; description: string }> = {
  free_consult: { title: "Free consult", description: "A 30-minute call to talk through your results and what to do next." },
  prelaunch_repo_review: { title: "Free pre-launch repo review", description: REPO_REVIEW_SCOPE },
  repo_review: { title: "Free repo review", description: REPO_REVIEW_SCOPE },
  repo_architecture_review: { title: "Free repo + architecture review", description: REPO_REVIEW_SCOPE },
  next_stage_consult: {
    title: "Consult on your next stage",
    description: "Enterprise readiness, SOC 2 and due diligence prep, in a free 30-minute call.",
  },
};

export function joinList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

const REVIEWS: OfferId[] = ["prelaunch_repo_review", "repo_review", "repo_architecture_review"];

export function technicalInvite(result: Result): string {
  const review = REVIEWS.includes(result.offer.primary);
  const blind = result.blindSpots.map((a) => AREA_LABELS[a].toLowerCase());
  if (blind.length > 0) {
    return `You weren't sure about ${joinList(blind)} — that's exactly what ${
      review ? "a 30-minute repo review" : "a free consult"
    } covers.`;
  }
  if (result.flags.length > 0) {
    const n = result.flags.length;
    return `You have ${n} critical issue${n === 1 ? "" : "s"} to look at. A 30-minute repo review is the fastest way to confirm ${
      n === 1 ? "it" : "them"
    } and plan the fix.`;
  }
  if (result.offer.primary === "next_stage_consult") {
    return "You're in good shape. Let's talk about what the next stage needs.";
  }
  return "Want a second pair of eyes on your next steps? Book a free consult.";
}

const BLOCKER_LABELS = new Map(
  (IDEA_QUESTIONS.flatMap((g) => g.questions).find((q) => q.id === "i5_blockers")?.options ?? []).map((o) => [
    o.value,
    o.label.toLowerCase(),
  ]),
);

export function ideaInvite(answers: Answers): string {
  const blockers = (Array.isArray(answers.i5_blockers) ? answers.i5_blockers : [])
    .filter((b) => b !== "other")
    .map((b) => BLOCKER_LABELS.get(b))
    .filter((b): b is string => !!b);
  if (blockers.length === 0) return "A free 30-minute consult is a quick way to pressure-test the idea and plan the first version.";
  return `You said ${joinList(blockers)} ${
    blockers.length === 1 ? "has" : "have"
  } held you back so far. A free 30-minute consult is a quick way to get past that.`;
}
