ALTER TABLE portal.document_requests
  ADD COLUMN IF NOT EXISTS related_request_id uuid REFERENCES portal.document_requests(id);
