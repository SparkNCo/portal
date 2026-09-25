// @ts-nocheck
import { supabase } from "../client.ts";
import { authorizeRequesterAction } from "./guards.ts";

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

  const authError = await authorizeRequesterAction(schema, id, deletedBy, "delete");
  if (authError) return authError;

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
