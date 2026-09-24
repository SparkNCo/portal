// @ts-nocheck
import { supabase } from "../client.ts";

// PATCH /document-requests { action: "edit" } — only the original requester
// can edit their own request (no admin bypass). Not available once the
// request is done — the document has already been delivered against
// whatever it said at the time, so rewriting it after doesn't make sense
// (same principle as tests/index.ts's "can't edit a passed test") — and not
// once a developer has claimed it either, so they're not left working off a
// version of the request that quietly changed underneath them mid-claim.
export async function editDocumentRequest(
  body: {
    id?: string;
    editedBy?: string;
    title?: string;
    description?: string;
    projectId?: string;
    projectName?: string;
    relatedRequestId?: string;
  },
  schema: string,
): Promise<Response> {
  const { id, editedBy, title, description, projectId, projectName, relatedRequestId } = body;

  if (!id || !editedBy || !title?.trim()) {
    return Response.json({ error: "Missing id, editedBy, or title" }, { status: 400 });
  }

  const { data: existing, error: fetchError } = await supabase
    .schema(schema)
    .from("document_requests")
    .select("requested_by, status, claimed_by")
    .eq("id", id)
    .maybeSingle();

  if (fetchError) {
    return Response.json(
      { error: "Failed to load document request", details: fetchError.message },
      { status: 500 },
    );
  }
  if (!existing) {
    return Response.json({ error: "Request not found" }, { status: 404 });
  }
  if (existing.status === "done") {
    return Response.json(
      { error: "This request has already been fulfilled and can no longer be edited" },
      { status: 400 },
    );
  }
  if (existing.claimed_by) {
    return Response.json(
      { error: `This request has been claimed by ${existing.claimed_by} and can no longer be edited` },
      { status: 400 },
    );
  }

  if (existing.requested_by !== editedBy) {
    return Response.json(
      { error: "Only the person who requested this can edit it" },
      { status: 403 },
    );
  }

  const { data, error } = await supabase
    .schema(schema)
    .from("document_requests")
    .update({
      title: title.trim(),
      description: description ?? null,
      project_id: projectId ?? null,
      project_name: projectName ?? null,
      related_request_id: relatedRequestId ?? null,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return Response.json(
      { error: "Failed to update document request", details: error.message },
      { status: 500 },
    );
  }

  return Response.json(data);
}
