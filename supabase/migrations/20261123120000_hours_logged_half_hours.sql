-- Log Hours: half hours (1.5, 7.5…) and at most 24 per entry.
-- `hours` was an integer; numeric(3,1) holds 0.5 … 24.0. Existing whole-hour
-- rows convert as they are (4 → 4.0).

ALTER TABLE portal.hours_logged DROP CONSTRAINT IF EXISTS hours_logged_hours_check;

ALTER TABLE portal.hours_logged ALTER COLUMN hours TYPE numeric(3,1) USING hours::numeric(3,1);

-- Same rule as supabase/functions/hours/hoursRules.ts: more than 0, at most
-- 24, in steps of half an hour.
ALTER TABLE portal.hours_logged ADD CONSTRAINT hours_logged_hours_check
  CHECK (hours > 0 AND hours <= 24 AND hours * 2 = floor(hours * 2));
