-- Documents visible to their whole initiative.
--
-- A document with initiative_wide = true can be seen (and shared, deleted…)
-- by everyone on its initiative at the time they look: the customer, its
-- stakeholders and its developers, including people assigned later. Who's
-- on the initiative is worked out when access is checked
-- (supabase/functions/storage/access.ts), not stored per document, so
-- leaving the initiative takes that access away too. document_permissions
-- rows still give access to specific people (uploader, requester, shares).
--
-- Every document uploaded from now on is initiative_wide. Documents that
-- existed before keep exactly the access they had (false).

ALTER TABLE portal.documents ADD COLUMN IF NOT EXISTS initiative_wide boolean NOT NULL DEFAULT false;
