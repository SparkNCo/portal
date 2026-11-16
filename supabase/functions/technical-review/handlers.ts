// @ts-nocheck
// Technical review (SPA-586) endpoints, called by the marketing site's
// /technical-review page. Public (anon key): a run is identified by its
// random reviewId, which only that browser knows. Flow and rules:
// marketing-site/docs/TECHNICAL_REVIEW_FLOW.md
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { supabase } from "../client.ts";
import { escapeIlike } from "../utils/slug.ts";
import { sendEmail } from "../lib/mailer.ts";
import {
  INTRO,
  NEXT_STAGE,
  OFFER_COPY,
  agentsMd,
  buildPlan,
  questionnaire,
  contextFromAnswers,
  findingsFor,
  ideaInvite,
  ideaPlayback,
  ideaProfile,
  sanitizeAnswers,
  scoreCompleted,
  scoreRun,
  technicalInvite,
  type Answers,
} from "./engine/index.ts";
import { detectModules, enrichIdea, ideaGaps, prefillScope } from "./ai.ts";
import { ideaReportEmail, signInEmail, technicalReportEmail } from "./report.ts";

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
      agentsMd: agentsMd({ answers, ideaGaps: gaps }),
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
    agentsMd: agentsMd({ answers, ctx, plan }),
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

// ── POST /score ─────────────────────────────────────────────────────────────
// /assessment's running score, after each checklist section is finished:
// ownership (initial form) plus the finished sections only.
const ScoreSchema = z.object({
  reviewId: z.string().uuid(),
  answers: z.record(z.unknown()).optional(),
  completed: z.array(z.string().max(40)).max(30),
});

export async function handleScore(req: Request) {
  const parsed = ScoreSchema.safeParse(await readBody(req));
  if (!parsed.success) return bad("Invalid score request");
  const review = await loadReview(parsed.data.reviewId);
  if (!review) return bad("Review not found", 404);
  const answers = await saveAnswers(review, parsed.data.answers ?? {});
  if (!TECH_STAGES.includes(answers.stage as string)) return bad("The score is only for Building, MVP and Scaling");

  const ctx = contextFromAnswers(answers, storedAiModules(review));
  const result = scoreCompleted(ctx, buildPlan(ctx), answers, parsed.data.completed);
  return json({ overall: result.overall, areas: result.areas });
}

// ── POST /sign-in ───────────────────────────────────────────────────────────
// "Sign in to save progress": emails a magic link. The account is a portal
// user with role "lead" (the portal's login turns that role away, so it gives
// no access to app.buildwithspark.co). Existing users keep their role.
const SITE_ORIGINS = (Deno.env.get("ASSESSMENT_SITE_ORIGINS") ??
  "https://buildwithspark.co,https://www.buildwithspark.co,http://localhost:4321")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);
const DEFAULT_ORIGIN = SITE_ORIGINS[0];

const SignInSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  origin: z.string().max(200).optional(),
});


// The newest assessment lead for this email, if any.
async function findLeadByEmail(email: string) {
  const { data, error } = await db()
    .from("leads")
    .select("lead_id, email, first_name")
    .ilike("email", escapeIlike(email))
    .eq("discovery_state", "technical_review")
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  return data?.[0] ?? null;
}

// Makes sure there's an Auth account and a portal.users row for this email.
async function ensureAuthUser(email: string) {
  const { error: createError } = await supabase.auth.admin.createUser({ email, email_confirm: true });
  if (createError && !/already (been )?registered|already exists/i.test(createError.message)) {
    throw new Error(`Auth user failed: ${createError.message}`);
  }
}

async function ensurePortalUser(authUserId: string, email: string, firstName: string | null) {
  const portal = supabase.schema("portal");
  const { data: byId, error } = await portal.from("users").select("id").eq("id", authUserId).maybeSingle();
  if (error) throw error;
  if (byId) return;
  const { data: byEmail, error: emailError } = await portal.from("users").select("id").ilike("email", escapeIlike(email)).limit(1);
  if (emailError) throw emailError;
  if (byEmail?.length) return; // someone already uses this email in the portal: leave them alone
  const { error: insertError } = await portal
    .from("users")
    .insert({ id: authUserId, email, role: "lead", firstName: firstName || null });
  if (insertError) throw insertError;
}

export async function handleSignIn(req: Request) {
  const parsed = SignInSchema.safeParse(await readBody(req));
  if (!parsed.success) return bad("Enter a valid email");
  const { email } = parsed.data;
  const origin = SITE_ORIGINS.includes(parsed.data.origin ?? "") ? parsed.data.origin : DEFAULT_ORIGIN;

  // Only for people who started an assessment, so this can't be used to
  // create accounts or send links to any address.
  const lead = await findLeadByEmail(email);
  if (!lead) return bad("We couldn't find an assessment for this email. Start one first.", 404);

  await ensureAuthUser(email);
  const { data, error } = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo: `${origin}/assessment` },
  });
  if (error) throw new Error(`Sign-in link failed: ${error.message}`);
  await ensurePortalUser(data.user.id, email, lead.first_name);

  const mail = signInEmail({ name: lead.first_name, link: data.properties.action_link });
  const { error: sendError } = await sendEmail({ to: email, subject: mail.subject, html: mail.html });
  if (sendError) {
    console.error("[technical-review] sign-in email failed:", sendError);
    return bad("We couldn't send the email. Please try again.", 502);
  }
  return json({ ok: true });
}

// ── POST /resume ────────────────────────────────────────────────────────────
// Signed in (Authorization: Bearer <user access token>): their newest
// assessment, so they can continue on another device.
export async function handleResume(req: Request) {
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: auth, error: authError } = await supabase.auth.getUser(token);
  const email = auth?.user?.email?.toLowerCase();
  if (authError || !email) return bad("Sign in first", 401);

  const { data: leads, error: leadsError } = await db()
    .from("leads")
    .select("lead_id, email, first_name, company")
    .ilike("email", escapeIlike(email))
    .eq("discovery_state", "technical_review");
  if (leadsError) throw leadsError;
  if (!leads?.length) return json({ review: null });

  const { data: reviews, error } = await db()
    .from("technical_reviews")
    .select("*")
    .in(
      "lead_id",
      leads.map((l) => l.lead_id),
    )
    .order("updated_at", { ascending: false, nullsFirst: false })
    .limit(1);
  if (error) throw error;
  const review = reviews?.[0];
  if (!review) return json({ review: null });

  const answers: Answers = review.answers ?? {};
  let plan = null;
  if (TECH_STAGES.includes(answers.stage as string) && review.modules) {
    try {
      plan = buildPlan(contextFromAnswers(answers, storedAiModules(review)));
    } catch {
      plan = null; // intake not finished: the page asks for the plan again
    }
  }
  // The intro page's answers are stored on the lead (and the role on the
  // run), not in `answers`.
  const lead = leads.find((l) => l.lead_id === review.lead_id);
  const intro = {
    intro_email: lead?.email ?? email,
    ...(lead?.first_name && { intro_name: lead.first_name }),
    ...(lead?.company && { intro_company: lead.company }),
    ...(review.role && { intro_role: review.role }),
  };
  return json({
    review: {
      reviewId: review.id,
      answers,
      plan,
      updatedAt: review.updated_at ?? review.created_at,
      completed: !!review.completed_at,
    },
    intro,
  });
}
