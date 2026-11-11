-- Technical review questionnaire (SPA-586) on the marketing site.
-- One row per run, linked to the lead created when the intro is done, so a
-- run abandoned halfway still leaves a lead. Answers keep the question IDs
-- from marketing-site/docs/TECHNICAL_REVIEW_FLOW.md.

CREATE TABLE IF NOT EXISTS marketing.technical_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES marketing.leads(lead_id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- Internal only (lead tagging, follow-up); never changes questions or results.
  role text,
  stage text CHECK (stage IN ('idea', 'building', 'mvp', 'scaling')),

  -- Every answer so far, by question ID (step 4 scope, T1–T3, checks, I1–I7).
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- For drop-off analysis.
  last_question text,

  -- Context modules triggered: [{ id, label, source: "rule" | "ai", reason? }].
  modules jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- Module questions cut by the cap ("also worth checking").
  overflow jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Results (Building / MVP / Scaling).
  overall_score integer CHECK (overall_score BETWEEN 0 AND 100),
  area_scores jsonb, -- [{ area, label, score, status, unsure, answered }]
  critical_flags jsonb, -- [{ id, title }]
  blind_spots text[],
  -- Results (Idea): the AI gap analysis, 3 gaps with next steps.
  idea_gaps jsonb,
  completed_at timestamptz,

  -- Report email: only sent after the person confirms the address.
  email_confirmed boolean NOT NULL DEFAULT false,
  report_sent_at timestamptz,
  -- Capped, so "Edit email" can't be used to send reports to many addresses.
  report_sends integer NOT NULL DEFAULT 0,

  -- Offer shown, the one they chose, and whether they booked it.
  offer_primary text,
  offer_secondary text[],
  chosen_offer text,
  booked boolean NOT NULL DEFAULT false,
  booked_at timestamptz
);

CREATE INDEX IF NOT EXISTS technical_reviews_lead_id_idx ON marketing.technical_reviews (lead_id);
CREATE INDEX IF NOT EXISTS technical_reviews_created_at_idx ON marketing.technical_reviews (created_at DESC);

-- Only edge functions (service role) read and write it. Tables created in
-- the marketing schema don't get grants by default, so give them here.
ALTER TABLE marketing.technical_reviews ENABLE ROW LEVEL SECURITY;
GRANT ALL ON marketing.technical_reviews TO service_role;
