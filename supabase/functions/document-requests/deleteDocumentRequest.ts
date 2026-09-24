// @ts-nocheck
import { supabase } from "../client.ts";

// PATCH /document-requests { action: "delete" } — only the original
// requester can remove their own request (no admin bypass). Same guards as
// editDocumentRequest.ts (not done, not claimed) and for the same reasons —
// nothing to delete out from under an already-delivered document or a
// developer already working off it.
export async function deleteDocumentRequest(
  body: { id?: string; deletedBy?: string },
  schema: string,
): Promise<Response> {
  const { id, deletedBy } = body;

  if (!id || !deletedBy) {
    return Response.json({ error: "Missing id or deletedBy" }, { status: 400 });
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
      { error: "This request has already been fulfilled and can no longer be deleted" },
      { status: 400 },
    );
  }
  if (existing.claimed_by) {
    return Response.json(
      { error: `This request has been claimed by ${existing.claimed_by} and can no longer be deleted` },
      { status: 400 },
    );
  }

  if (existing.requested_by !== deletedBy) {
    return Response.json(
      { error: "Only the person who requested this can delete it" },
      { status: 403 },
    );
  }

  // Other requests can point back at this one via related_request_id — null
  // that out first rather than leaving a dangling reference (no FK to
  // enforce/cascade it, this table just stores the id as a plain column).
  await supabase
    .schema(schema)
    .from("document_requests")
    .update({ related_request_id: null })
    .eq("related_request_id", id);

  const { error } = await supabase
    .schema(schema)
    .from("document_requests")
    .delete()
    .eq("id", id);

  if (error) {
    return Response.json(
      { error: "Failed to delete document request", details: error.message },
      { status: 500 },
    );
  }

  return Response.json({ success: true, id });
}
