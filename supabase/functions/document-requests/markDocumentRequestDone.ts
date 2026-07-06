// @ts-nocheck
import { supabase } from "../client.ts";

// PATCH /document-requests { action: "complete" } — developer marks a request
// as fulfilled. If the request is claimed, only the claimer (or an admin) may
// complete it — prevents two developers racing to finish the same request.
export async function markDocumentRequestDone(
  body: {
    id?: string;
    completedBy?: string;
  },
  schema: string,
): Promise<Response> {
  const { id, completedBy } = body;

  if (!id) {
    return Response.json({ error: "Missing id" }, { status: 400 });
  }

  const { data: existing, error: fetchError } = await supabase
    .schema(schema)
    .from("document_requests")
    .select("claimed_by")
    .eq("id", id)
    .maybeSingle();

  if (fetchError) {
    return Response.json(
      { error: "Failed to load document request", details: fetchError.message },
      { status: 500 },
    );
  }

  if (existing?.claimed_by && existing.claimed_by !== completedBy) {
    const { data: requester } = await supabase
      .schema(schema)
      .from("users")
      .select("role")
      .eq("email", completedBy)
      .maybeSingle();

    if (requester?.role !== "admin") {
      return Response.json(
        { error: `Request is claimed by ${existing.claimed_by}` },
        { status: 409 },
      );
    }
  }

  const { data, error } = await supabase
    .schema(schema)
    .from("document_requests")
    .update({
      status: "done",
      completed_at: new Date().toISOString(),
      completed_by: completedBy ?? null,
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
