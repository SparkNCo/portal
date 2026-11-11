// @ts-nocheck
// Technical review (SPA-586) endpoints, called by the marketing site's
// /technical-review page. Public (anon key): a run is identified by its
// random reviewId, which only that browser knows. Flow and rules:
// marketing-site/docs/TECHNICAL_REVIEW_FLOW.md
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { supabase } from "../client.ts";
import { sendEmail } from "../lib/mailer.ts";
import {
  INTRO,
  NEXT_STAGE,
  OFFER_COPY,
  buildPlan,
  questionnaire,
  contextFromAnswers,
  findingsFor,
  ideaInvite,
  ideaPlayback,
  ideaProfile,
  sanitizeAnswers,
  scoreRun,
  technicalInvite,
  type Answers,
} from "./engine/index.ts";
import { detectModules, enrichIdea, ideaGaps, prefillScope } from "./ai.ts";
import { ideaReportEmail, technicalReportEmail } from "./report.ts";

const BOOKING_URL = Deno.env.get("TECHNICAL_REVIEW_BOOKING_URL") ?? "https://cal.com/kabir-malkani-glnivq/consult";
// Report emails per run (the first send plus a couple of "Edit email" fixes).
const MAX_REPORT_SENDS = 3;
const ROLES = INTRO.find((q) => q.id === "intro_role")!.options!.map((o) => o.value) as [string, ...string[]];
const TECH_STAGES = ["building", "mvp", "scaling"];

const db = () => supabase.schema("marketing");
const json = (body: unknown, status = 200) => Response.json(body, { status });
const bad = (error: string, status = 400) => json({ error }, status);

const ReviewId = z.string().uuid();

async function readBody(req: Request) {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

async function loadReview(reviewId: unknown) {
  const id = ReviewId.safeParse(reviewId);
  if (!id.success) return null;
  const { data, error } = await db().from("technical_reviews").select("*").eq("id", id.data).maybeSingle();
  if (error) throw error;
  return data;
}

async function loadLead(leadId: string) {
  const { data, error } = await db().from("leads").select("lead_id, email, first_name, company").eq("lead_id", leadId).single();
  if (error) throw error;
  return data;
}

// Merges new answers into the stored ones and saves them (with the stage
// and last question reached, for drop-off analysis).
async function saveAnswers(review, incoming: unknown, lastQuestion?: unknown): Promise<Answers> {
  const answers: Answers = { ...(review.answers ?? {}), ...sanitizeAnswers(incoming) };
  const patch: Record<string, unknown> = { answers, updated_at: new Date().toISOString() };
  if (typeof answers.stage === "string") patch.stage = answers.stage;
  if (typeof lastQuestion === "string" && lastQuestion.length <= 100) patch.last_question = lastQuestion;

  const { error } = await db().from("technical_reviews").update(patch).eq("id", review.id);
  if (error) throw error;

  if (typeof answers.scope_industry === "string") {
    // Best-effort: shows on the lead row too.
    await db().from("leads").update({ industry: answers.scope_industry }).eq("lead_id", review.lead_id);
  }
  return answers;
}

// Modules the AI added when the plan was shown, so scoring uses the same plan.
const storedAiModules = (review) =>
  (review.modules ?? []).filter((m) => m.source === "ai").map((m) => ({ id: m.id, reason: m.reason ?? "" }));

// ── POST /questions ─────────────────────────────────────────────────────────
// The fixed pages (intro, stage, about, scope, intake, Idea questions).
export async function handleQuestions(_req: Request) {
  return json(questionnaire());
}

// ── POST /start ─────────────────────────────────────────────────────────────
// After the intro: the lead exists from here on, even if they drop off.
const StartSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  name: z.string().trim().min(1).max(200),
  company: z.string().trim().max(200).optional().nullable(),
  role: z.enum(ROLES),
});

export async function handleStart(req: Request) {
  const parsed = StartSchema.safeParse(await readBody(req));
  if (!parsed.success) return json({ error: "Invalid intro", details: parsed.error.flatten() }, 400);
  const { email, name, company, role } = parsed.data;

  const leadId = crypto.randomUUID();
  const { error: leadError } = await db().from("leads").insert({
    lead_id: leadId,
    email,
    first_name: name,
    company: company || null,
    discovery_state: "technical_review",
  });
  if (leadError) throw leadError;

  const { data, error } = await db().from("technical_reviews").insert({ lead_id: leadId, role }).select("id").single();
  if (error) {
    // Don't leave a lead without its run.
    await db().from("leads").delete().eq("lead_id", leadId);
    throw error;
  }

  return json({ reviewId: data.id }, 201);
}

// ── POST /progress ──────────────────────────────────────────────────────────
export async function handleProgress(req: Request) {
  const body = await readBody(req);
  const review = await loadReview(body?.reviewId);
  if (!review) return bad("Review not found", 404);
  await saveAnswers(review, body.answers, body.lastQuestion);
  return json({ ok: true });
}

// ── POST /prefill ───────────────────────────────────────────────────────────
// After step 3: AI guesses for step 4 (scope). The person confirms them.
export async function handlePrefill(req: Request) {
  const body = await readBody(req);
  const review = await loadReview(body?.reviewId);
  if (!review) return bad("Review not found", 404);
  const answers = await saveAnswers(review, body.answers, body.lastQuestion);
  return json({ scope: await prefillScope(answers) });
}

// ── POST /plan ──────────────────────────────────────────────────────────────
// After T1–T3: the stage questions, with context modules (rules first, AI as
// a backup detector) and hidden questions applied.
export async function handlePlan(req: Request) {
  const body = await readBody(req);
  const review = await loadReview(body?.reviewId);
  if (!review) return bad("Review not found", 404);
  const answers = await saveAnswers(review, body.answers, body.lastQuestion);
  if (!TECH_STAGES.includes(answers.stage as string)) return bad("The plan is only for Building, MVP and Scaling");

  const ruleCtx = contextFromAnswers(answers);
  const aiModules = await detectModules(answers, ruleCtx);
  const plan = buildPlan({ ...ruleCtx, aiModules });

  const { error } = await db()
    .from("technical_reviews")
    .update({ modules: plan.modules, overflow: plan.overflow, updated_at: new Date().toISOString() })
    .eq("id", review.id);
  if (error) throw error;

  return json({ plan });
}

// ── POST /enrich ────────────────────────────────────────────────────────────
// Idea branch: AI examples and placeholders. Empty when the AI isn't ready;
// the page then shows the base wording.
export async function handleEnrich(req: Request) {
  const body = await readBody(req);
  const review = await loadReview(body?.reviewId);
  if (!review) return bad("Review not found", 404);
  const answers = await saveAnswers(review, body.answers, body.lastQuestion);
  if (answers.stage !== "idea") return bad("Enrichment is only for the Idea branch");
  return json({ enrichment: await enrichIdea(answers) });
}

// Offer ids with their title and description, for the page.
const describeOffer = (offer) => ({
  primary: { id: offer.primary, ...OFFER_COPY[offer.primary] },
  secondary: offer.secondary.map((id) => ({ id, ...OFFER_COPY[id] })),
});

// Everything the results page and the email show, from the stored run.
async function buildResults(review, answers: Answers) {
  if (answers.stage === "idea") {
    const gaps = review.idea_gaps ?? (await ideaGaps(answers)).gaps;
    return {
      stage: "idea",
      playback: ideaPlayback(answers), // plain list, for the email
      profile: ideaProfile(answers), // product card, for the page
      gaps,
      offer: { primary: "free_consult", secondary: [] },
      offers: describeOffer({ primary: "free_consult", secondary: [] }),
      invite: ideaInvite(answers),
      bookingUrl: BOOKING_URL,
    };
  }

  const ctx = contextFromAnswers(answers, storedAiModules(review));
  const plan = buildPlan(ctx);
  const result = scoreRun(ctx, plan, answers);
  return {
    stage: ctx.stage,
    result,
    findings: findingsFor(ctx, plan, answers),
    nextStage: NEXT_STAGE[ctx.stage],
    overflow: plan.overflow,
    modules: plan.modules,
    offers: describeOffer(result.offer),
    invite: technicalInvite(result),
    bookingUrl: BOOKING_URL,
  };
}

// ── POST /complete ──────────────────────────────────────────────────────────
// After the last question: results for the page (shown before any booking
// ask). The email goes out only after /confirm-email.
export async function handleComplete(req: Request) {
  const body = await readBody(req);
  const review = await loadReview(body?.reviewId);
  if (!review) return bad("Review not found", 404);
  const answers = await saveAnswers(review, body.answers, body.lastQuestion);
  if (!["idea", ...TECH_STAGES].includes(answers.stage as string)) return bad("Pick a stage first");

  const results = await buildResults({ ...review, idea_gaps: null }, answers);
  const patch: Record<string, unknown> = {
    completed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    offer_primary: results.offer?.primary ?? results.result?.offer.primary,
    offer_secondary: results.offer?.secondary ?? results.result?.offer.secondary,
  };
  if (results.stage === "idea") {
    patch.idea_gaps = results.gaps;
  } else {
    patch.overall_score = results.result.overall;
    patch.area_scores = results.result.areas;
    patch.critical_flags = results.result.flags;
    patch.blind_spots = results.result.blindSpots;
  }
  const { error } = await db().from("technical_reviews").update(patch).eq("id", review.id);
  if (error) throw error;

  return json(results);
}

// ── POST /confirm-email ─────────────────────────────────────────────────────
// "We'll send your report to [email]. Is that right?" — sends it once per
// address and at most MAX_REPORT_SENDS times per run, so the endpoint can't
// be used to spam.
const ConfirmSchema = z.object({ reviewId: z.string().uuid(), email: z.string().trim().toLowerCase().email().max(254) });

export async function handleConfirmEmail(req: Request) {
  const parsed = ConfirmSchema.safeParse(await readBody(req));
  if (!parsed.success) return bad("Invalid email");
  const review = await loadReview(parsed.data.reviewId);
  if (!review) return bad("Review not found", 404);
  if (!review.completed_at) return bad("Finish the questionnaire first");

  const lead = await loadLead(review.lead_id);
  const email = parsed.data.email;
  const changed = email !== String(lead.email ?? "").toLowerCase();
  if (review.report_sent_at && !changed) return json({ ok: true, alreadySent: true });
  if ((review.report_sends ?? 0) >= MAX_REPORT_SENDS) {
    return bad("We've already sent this report several times. Contact us if you need it again.", 429);
  }

  if (changed) {
    const { error } = await db().from("leads").update({ email }).eq("lead_id", review.lead_id);
    if (error) throw error;
  }

  const results = await buildResults(review, review.answers ?? {});
  const mail =
    results.stage === "idea"
      ? ideaReportEmail({ name: lead.first_name, ...results })
      : technicalReportEmail({
          name: lead.first_name,
          ...results,
          aiModules: results.modules.filter((m) => m.source === "ai"),
        });

  const { error: sendError } = await sendEmail({ to: email, subject: mail.subject, html: mail.html });
  if (sendError) {
    console.error("[technical-review] report email failed:", sendError);
    return bad("We couldn't send the email. Please try again.", 502);
  }

  const now = new Date().toISOString();
  const { error } = await db()
    .from("technical_reviews")
    .update({ email_confirmed: true, report_sent_at: now, report_sends: (review.report_sends ?? 0) + 1, updated_at: now })
    .eq("id", review.id);
  if (error) throw error;

  return json({ ok: true });
}

// ── POST /book ──────────────────────────────────────────────────────────────
// The page calls this when they open the booking link for an offer.
const BookSchema = z.object({
  reviewId: z.string().uuid(),
  offer: z.enum(["free_consult", "prelaunch_repo_review", "repo_review", "repo_architecture_review", "next_stage_consult"]),
});

export async function handleBook(req: Request) {
  const parsed = BookSchema.safeParse(await readBody(req));
  if (!parsed.success) return bad("Invalid offer");
  const review = await loadReview(parsed.data.reviewId);
  if (!review) return bad("Review not found", 404);

  const now = new Date().toISOString();
  const { error } = await db()
    .from("technical_reviews")
    .update({ chosen_offer: parsed.data.offer, booked: true, booked_at: now, updated_at: now })
    .eq("id", review.id);
  if (error) throw error;

  return json({ ok: true });
}
