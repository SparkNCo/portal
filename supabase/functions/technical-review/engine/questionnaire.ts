// The fixed pages of the questionnaire, as the marketing site renders them.
// The site lives in another repo, so it asks for these instead of copying
// them; the stage-specific checks come from buildPlan.
import { IDEA_QUESTIONS, INTAKE, INTRO, SCOPE, STAGE_QUESTION, aboutQuestions } from "./catalog.ts";
import { ownershipQuestions } from "./plan.ts";

// /assessment checklist modules built from the old intake pages. Their
// answers are context for the plan and the report, not scored (except the
// Yes / No / Unsure ownership checks in Governance).
const DATA_PRIVACY_IDS = new Set(["scope_region", "scope_children"]);
const scopeQuestions = SCOPE.filter((q) => !DATA_PRIVACY_IDS.has(q.id));
const dataPrivacyQuestions = SCOPE.filter((q) => DATA_PRIVACY_IDS.has(q.id));
const team = INTAKE.filter((q) => q.id === "t1_team");
const buildQuestions = INTAKE.filter((q) => q.id !== "t1_team");

export function questionnaire() {
  return {
    // /assessment: page 1, then the checklist.
    checklist: {
      intro: {
        title: "Find the gaps in your product",
        copy: "Start with the basics. Next you'll get a checklist tailored to your product, to answer at your own pace.",
        questions: [...INTRO, STAGE_QUESTION],
      },
      productScope: {
        key: "product_scope",
        title: "Product scope",
        copy: "What you're building, who it's for and what it's built with. This tailors the rest of your checklist.",
        privacyNote: "We don't share this with anyone. We use it only to tailor your checklist and your report.",
        // About is required in Idea, optional in Building / MVP / Scaling.
        questions: {
          idea: [...aboutQuestions("idea"), ...scopeQuestions],
          technical: [...aboutQuestions("building"), ...scopeQuestions, ...buildQuestions],
        },
      },
      governance: {
        key: "governance",
        title: "Governance",
        copy: "Who works on the product, and who owns and controls it.",
        // Building / MVP / Scaling only.
        questions: [...team, ...ownershipQuestions()],
      },
      dataPrivacy: {
        key: "data_privacy",
        title: "Data privacy",
        copy: "Where your users are and who they are, so we ask the right privacy questions.",
        questions: dataPrivacyQuestions,
        // MVP's "Privacy & compliance" area is shown inside this module.
        mergesArea: "privacy",
      },
    },

    // Previous one-page-at-a-time layout, kept while older site builds are live.
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
