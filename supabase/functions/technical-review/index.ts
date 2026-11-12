// @ts-nocheck
// Technical review (SPA-586): backend for the marketing site's public
// /technical-review questionnaire. All routes are POST:
//   /questions      the fixed pages (intro, stage, about, scope, intake, Idea)
//   /start          intro done → creates the lead, returns { reviewId }
//   /progress       saves answers + last question reached
//   /prefill        AI guesses for the scope page from the description
//   /plan           Building / MVP / Scaling questions for this context
//   /enrich         Idea branch AI examples (empty if the AI isn't ready)
//   /complete       results for the page
//   /confirm-email  sends the report (once per address)
//   /book           records the offer they chose to book
import { serveWithCors } from "../utils/serve.ts";
import {
  handleBook,
  handleComplete,
  handleConfirmEmail,
  handleEnrich,
  handlePlan,
  handlePrefill,
  handleProgress,
  handleQuestions,
  handleStart,
} from "./handlers.ts";

const ROUTES: Record<string, (req: Request) => Promise<Response>> = {
  questions: handleQuestions,
  start: handleStart,
  progress: handleProgress,
  prefill: handlePrefill,
  plan: handlePlan,
  enrich: handleEnrich,
  complete: handleComplete,
  "confirm-email": handleConfirmEmail,
  book: handleBook,
};

serveWithCors("technical-review", async (req) => {
  const action = new URL(req.url).pathname.split("/").filter(Boolean).pop() ?? "";
  const handler = ROUTES[action];
  if (req.method !== "POST" || !handler) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  return handler(req);
});
