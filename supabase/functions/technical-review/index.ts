// @ts-nocheck
// Technical review (SPA-586): backend for the marketing site's public
// /technical-review questionnaire. All routes are POST:
//   /questions      the fixed pages (intro, stage, about, scope, intake, Idea)
//   /start          intro done → creates the lead, returns { reviewId }
//   /intro          first page edited later → updates the lead's details
//   /progress       saves answers + last question reached
//   /prefill        AI guesses for the scope page from the description
//   /plan           Building / MVP / Scaling questions for this context
//   /enrich         Idea branch AI examples (empty if the AI isn't ready)
//   /complete       results for the page
//   /confirm-email  sends the report (once per address)
//   /book           records the offer they chose to book
//   /score          running score of the finished checklist sections (/assessment)
//   /sign-in        emails a temporary passcode; creates the "lead" portal user
//   /resume         signed in: their newest assessment, to continue it
import { serveWithCors } from "../utils/serve.ts";
import {
  handleBook,
  handleComplete,
  handleConfirmEmail,
  handleEnrich,
  handleIntro,
  handlePlan,
  handlePrefill,
  handleProgress,
  handleQuestions,
  handleResume,
  handleScore,
  handleSignIn,
  handleStart,
} from "./handlers.ts";

const ROUTES: Record<string, (req: Request) => Promise<Response>> = {
  questions: handleQuestions,
  start: handleStart,
  intro: handleIntro,
  progress: handleProgress,
  prefill: handlePrefill,
  plan: handlePlan,
  enrich: handleEnrich,
  complete: handleComplete,
  "confirm-email": handleConfirmEmail,
  book: handleBook,
  score: handleScore,
  "sign-in": handleSignIn,
  resume: handleResume,
};

serveWithCors("technical-review", async (req) => {
  const action = new URL(req.url).pathname.split("/").filter(Boolean).pop() ?? "";
  const handler = ROUTES[action];
  if (req.method !== "POST" || !handler) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  return handler(req);
});
