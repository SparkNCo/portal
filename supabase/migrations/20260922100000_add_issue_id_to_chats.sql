-- Issue-linked chats (the "Chat" tab on a ticket) need a stable, idempotent
-- "get or create" the same way CometChat's getOrCreateIssueGroup.ts does
-- with its deterministic guid (issue_<id>) — two people opening the same
-- ticket's Chat tab and both sending the first message shouldn't create two
-- separate chats. A partial unique index on (issue_id) where type='issue'
-- gives Postgres itself the race-safety CometChat got from its guid being
-- derived from the issue id.
ALTER TABLE portal.chats ADD COLUMN IF NOT EXISTS issue_id text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_chats_issue_id_unique
  ON portal.chats(issue_id)
  WHERE type = 'issue';
