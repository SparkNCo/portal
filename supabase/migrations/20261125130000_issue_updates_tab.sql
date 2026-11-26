-- The ticket modal tab the last change was made in (chat, tests, decisions,
-- design, demo, or description for an edit of the ticket itself), so the
-- "Recently updated" badge on a ticket card opens the ticket straight there
-- (components/client/use-issue-update-badge.ts). Written by markIssueUpdated
-- (supabase/functions/utils/issueUpdates.ts) with every change.
--
-- Rows from before this have tab = null: their badge opens the modal on its
-- default tab, as before.

ALTER TABLE portal.issue_updates ADD COLUMN IF NOT EXISTS tab text;

ALTER TABLE portal.issue_updates
  ADD CONSTRAINT issue_updates_tab_check
  CHECK (tab IS NULL OR tab IN ('description', 'chat', 'decisions', 'tests', 'design', 'demo'));
