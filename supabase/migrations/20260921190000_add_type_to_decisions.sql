-- The "Decisions" tab (renamed to "Clarifications" in the UI) now also
-- takes plain statements — "Update Requirement" — alongside the existing
-- ask/answer questions. They live in the same portal.decisions table and
-- list (same shape, same notifications), distinguished only by `type`:
-- a 'requirement_update' row never gets a `decision` answer, so the UI
-- skips the answer form for it and the unanswered-count badge excludes it
-- (see issue-detail-modal.tsx's unansweredDecisionsCount).
ALTER TABLE portal.decisions
  ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'question'
    CHECK (type IN ('question', 'requirement_update'));
