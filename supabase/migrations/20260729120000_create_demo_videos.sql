-- Create demo_videos table to store versioned demo videos (uploaded files or embed links)
CREATE TABLE IF NOT EXISTS portal.demo_videos (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id       text NOT NULL,
  version        integer NOT NULL,
  source_type    text NOT NULL CHECK (source_type IN ('upload', 'embed')),
  file_name      text,
  file_url       text,
  storage_path   text,
  embed_url      text,
  embed_provider text,
  uploaded_by    uuid REFERENCES portal.users(id),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (issue_id, version),
  CONSTRAINT demo_videos_source_fields_check CHECK (
    (source_type = 'upload' AND file_url IS NOT NULL AND storage_path IS NOT NULL)
    OR
    (source_type = 'embed' AND embed_url IS NOT NULL)
  )
);

-- Create demo_video_comments table for the per-version feedback thread
CREATE TABLE IF NOT EXISTS portal.demo_video_comments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  demo_video_id uuid NOT NULL REFERENCES portal.demo_videos(id) ON DELETE CASCADE,
  author_id     uuid NOT NULL REFERENCES portal.users(id),
  body          text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_demo_videos_issue_id ON portal.demo_videos(issue_id);
CREATE INDEX IF NOT EXISTS idx_demo_videos_created_at ON portal.demo_videos(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_demo_video_comments_demo_video_id ON portal.demo_video_comments(demo_video_id);
CREATE INDEX IF NOT EXISTS idx_demo_video_comments_created_at ON portal.demo_video_comments(created_at);

-- updated_at triggers
CREATE OR REPLACE FUNCTION portal.update_demo_videos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_demo_videos_updated_at
  BEFORE UPDATE ON portal.demo_videos
  FOR EACH ROW
  EXECUTE FUNCTION portal.update_demo_videos_updated_at();

CREATE OR REPLACE FUNCTION portal.update_demo_video_comments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_demo_video_comments_updated_at
  BEFORE UPDATE ON portal.demo_video_comments
  FOR EACH ROW
  EXECUTE FUNCTION portal.update_demo_video_comments_updated_at();
