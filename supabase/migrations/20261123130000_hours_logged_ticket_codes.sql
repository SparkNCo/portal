-- Log Hours keeps the code and title of each ticket worked on (e.g.
-- { "id": "…", "code": "SPA-123", "title": "Export to PDF" }), saved with the
-- entry, so showing them needs no lookup in Linear. `id` stays so editing the
-- entry can tell which tickets are picked; issue_ids keeps being filled too.
--
-- Rows from before this have tickets = '[]': their tickets are still read
-- from issue_ids and looked up by id (supabase/functions/hours/hoursRules.ts
-- → entryTickets).

ALTER TABLE portal.hours_logged
  ADD COLUMN IF NOT EXISTS tickets jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE portal.hours_logged
  ADD CONSTRAINT hours_logged_tickets_is_array CHECK (jsonb_typeof(tickets) = 'array');
