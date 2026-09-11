-- "Preview Links" — admin-managed list of { url, text } shown at the top of
-- every issue's Demo tab for that customer (e.g. a link to their test
-- environment). Defaults to an empty array so existing rows and the
-- read path never have to special-case NULL.
ALTER TABLE portal.customers
  ADD COLUMN IF NOT EXISTS preview_links jsonb NOT NULL DEFAULT '[]'::jsonb;
