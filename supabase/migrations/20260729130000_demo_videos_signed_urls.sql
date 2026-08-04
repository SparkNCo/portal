-- demo-videos bucket is private, so uploaded files are served via
-- short-lived signed URLs generated on read instead of a permanent
-- public file_url. Relax the check constraint accordingly.
ALTER TABLE portal.demo_videos DROP CONSTRAINT IF EXISTS demo_videos_source_fields_check;

ALTER TABLE portal.demo_videos ADD CONSTRAINT demo_videos_source_fields_check CHECK (
  (source_type = 'upload' AND storage_path IS NOT NULL)
  OR
  (source_type = 'embed' AND embed_url IS NOT NULL)
);
