// The fixed pages of the questionnaire, as the marketing site renders them.
// The site lives in another repo, so it asks for these instead of copying
// them; the stage-specific checks come from buildPlan.
import { IDEA_QUESTIONS, INTAKE, INTRO, SCOPE, STAGE_QUESTION, aboutQuestions } from "./catalog.ts";
import { ownershipQuestions } from "./plan.ts";

export function questionnaire() {
  return {
    intro: {
      title: "Find the gaps in your product",
      copy: "Takes about 4 minutes. You'll get a personalized report at the end.",
      questions: INTRO,
    },
    stage: { title: "Where is your product today?", questions: [STAGE_QUESTION] },
    about: {
      title: "About your product",
      copy: "A few quick questions so we can skip what doesn't apply to you.",
      privacyNote: "We don't share this with anyone. We use it only to tailor the questions that follow and your report.",
      // Required in Idea, optional in Building / MVP / Scaling.
      questions: { idea: aboutQuestions("idea"), technical: aboutQuestions("building") },
    },
    scope: {
      title: "Scope",
      copy: "We've filled these in from your description. Change anything that's wrong, or just confirm.",
      questions: SCOPE,
    },
    intake: [
      { title: "Who's building it, and with what", questions: INTAKE },
      { title: "Ownership and control", questions: ownershipQuestions() },
    ],
    idea: IDEA_QUESTIONS.map((g) => ({ title: g.group, questions: g.questions })),
  };
}
