-- The bell now renders a fixed "There is a new <type> for <issue code>"
-- phrase instead of an actor/preview line, so it needs the human-readable
-- Linear code (e.g. "SPA-513") rather than the internal issue_id already in
-- object_id. Nullable — chat notifications aren't issue-scoped, so they omit
-- the "for <code>" part entirely (see components/notifications/NotificationBell.tsx).
ALTER TABLE portal.notifications ADD COLUMN IF NOT EXISTS issue_code text;
