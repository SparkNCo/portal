-- `object_id` on a decision/demo/design notification is that row's own id
-- (decision/demo_videos/design_resources), not the Linear issue it belongs
-- to — useless for /build and /bugs, which key their already-fetched issues
-- list by Linear issue id. Nullable — chat notifications have no issue.
ALTER TABLE portal.notifications ADD COLUMN IF NOT EXISTS issue_id text;
