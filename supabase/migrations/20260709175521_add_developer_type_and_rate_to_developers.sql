ALTER TABLE portal.developers
  ADD COLUMN IF NOT EXISTS developer_type text NOT NULL DEFAULT 'spark_fde'
    CHECK (developer_type IN ('spark_fde', 'internal')),
  ADD COLUMN IF NOT EXISTS rate_amount numeric,
  ADD COLUMN IF NOT EXISTS rate_type text
    CHECK (rate_type IN ('hourly', 'monthly', 'annual'));
