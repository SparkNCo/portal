-- Documents: one access level and soft delete.
--
-- Access: no more owner / write / read. A user either has access to a
-- document (a document_permissions row) or doesn't; anyone with access can
-- open, download, change the category, share and delete it. Every existing
-- row becomes 'access'. The column stays (text) so older code reading it
-- doesn't break; new rows write 'access'.
--
-- Soft delete: deleting a document only marks it (deleted_at / deleted_by).
-- The file stays in documents_bucket and the row and its permissions stay;
-- the documents list, search, downloads and "Ask about this project" skip it.

UPDATE portal.document_permissions SET permission = 'access' WHERE permission IS DISTINCT FROM 'access';

-- Older shares could leave the same user twice on a document: keep one row
-- each, then make that the rule.
DELETE FROM portal.document_permissions dp
USING portal.document_permissions other
WHERE dp.document_id = other.document_id
  AND dp.user_id = other.user_id
  AND dp.id > other.id;

CREATE UNIQUE INDEX IF NOT EXISTS document_permissions_document_user
  ON portal.document_permissions (document_id, user_id);

ALTER TABLE portal.documents ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE portal.documents ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES portal.users(id) ON DELETE SET NULL;

-- Most queries want the documents that aren't deleted.
CREATE INDEX IF NOT EXISTS documents_not_deleted ON portal.documents (project_slug) WHERE deleted_at IS NULL;
