-- Storage buckets and policies copied from the cloud project.
-- `supabase db dump` skips the storage schema, so these live apart from baseline.sql.
-- Safe to run more than once: buckets are upserted and policies recreated.
-- Only the configuration is copied, never the files.

BEGIN;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES
  ('signatures_bucket',   'signatures_bucket',   true,  NULL,     NULL),
  ('documents_bucket',    'documents_bucket',    false, NULL,     NULL),
  ('assets',              'assets',              true,  NULL,     NULL),
  ('diagrams_bucket',     'diagrams_bucket',     false, NULL,     NULL),
  ('demo-videos',         'demo-videos',         false, NULL,     NULL),
  ('chat-attachments',    'chat-attachments',    false, 26214400, NULL),
  ('data_source_schemas', 'data_source_schemas', false, 5242880,  '{application/json}')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- chat-attachments: only members of the chat (first folder = chat id)
DROP POLICY IF EXISTS "chat_attachments_insert" ON storage.objects;
CREATE POLICY "chat_attachments_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'chat-attachments' AND portal.can_access_chat(((storage.foldername(name))[1])::uuid));

DROP POLICY IF EXISTS "chat_attachments_select" ON storage.objects;
CREATE POLICY "chat_attachments_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'chat-attachments' AND portal.can_access_chat(((storage.foldername(name))[1])::uuid));

-- signatures_bucket: open to everyone, as in the cloud (names are the dashboard's)
DROP POLICY IF EXISTS "create 8qws1a_0" ON storage.objects;
CREATE POLICY "create 8qws1a_0" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'signatures_bucket');

DROP POLICY IF EXISTS "upload_signatures 8qws1a_0" ON storage.objects;
CREATE POLICY "upload_signatures 8qws1a_0" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'signatures_bucket');

DROP POLICY IF EXISTS "upload_signatures 8qws1a_1" ON storage.objects;
CREATE POLICY "upload_signatures 8qws1a_1" ON storage.objects FOR SELECT
  USING (bucket_id = 'signatures_bucket');

DROP POLICY IF EXISTS "upload_signatures 8qws1a_2" ON storage.objects;
CREATE POLICY "upload_signatures 8qws1a_2" ON storage.objects FOR UPDATE
  USING (bucket_id = 'signatures_bucket');

DROP POLICY IF EXISTS "upload_signatures 8qws1a_3" ON storage.objects;
CREATE POLICY "upload_signatures 8qws1a_3" ON storage.objects FOR DELETE
  USING (bucket_id = 'signatures_bucket');

COMMIT;
