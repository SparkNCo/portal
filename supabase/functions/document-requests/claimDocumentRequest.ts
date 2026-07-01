// @ts-nocheck
import { supabase } from "../client.ts";

// PATCH /document-requests { action: "claim" } — developer locks a pending
// request so other assigned developers can't also try to fulfill it at the
// same time. Optimistic: only succeeds if nobody has claimed it yet.
export async function claimDocumentRequest(
  body: {
    id?: string;
    claimedBy?: string;
  },
  schema: string,
): Promise<Response> {
  const { id, claimedBy } = body;

  if (!id || !claimedBy) {
    return Response.json({ error: "Missing id or claimedBy" }, { status: 400 });
  }

  const { data, error } = await supabase
    .schema(schema)
    .from("document_requests")
    .update({ claimed_by: claimedBy, claimed_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "pending")
    .is("claimed_by", null)
    .select()
    .maybeSingle();

  if (error) {
    return Response.json(
      { error: "Failed to claim request", details: error.message },
      { status: 500 },
    );
  }

  if (!data) {
    return Response.json(
      { error: "Request was already claimed by someone else" },
      { status: 409 },
    );
  }

  return Response.json(data);
}
