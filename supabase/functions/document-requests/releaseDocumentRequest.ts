// @ts-nocheck
import { supabase } from "../client.ts";

// PATCH /document-requests { action: "release" } — frees up a claimed request
// (e.g. the developer closed the upload modal without finishing) so another
// assigned developer can claim it. Only the original claimer or an admin may
// release it.
export async function releaseDocumentRequest(body: {
  id?: string;
  releasedBy?: string;
}): Promise<Response> {
  const { id, releasedBy } = body;

  if (!id || !releasedBy) {
    return Response.json({ error: "Missing id or releasedBy" }, { status: 400 });
  }

  const { data: requester } = await supabase
    .schema("portal")
    .from("users")
    .select("role")
    .eq("email", releasedBy)
    .maybeSingle();

  let query = supabase
    .schema("portal")
    .from("document_requests")
    .update({ claimed_by: null, claimed_at: null })
    .eq("id", id)
    .eq("status", "pending");

  if (requester?.role !== "admin") {
    query = query.eq("claimed_by", releasedBy);
  }

  const { data, error } = await query.select().maybeSingle();

  if (error) {
    return Response.json(
      { error: "Failed to release request", details: error.message },
      { status: 500 },
    );
  }

  if (!data) {
    return Response.json(
      { error: "Request is not claimed by you" },
      { status: 409 },
    );
  }

  return Response.json(data);
}
