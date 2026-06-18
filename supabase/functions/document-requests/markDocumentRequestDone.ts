// @ts-nocheck
import { supabase } from "../client.ts";

// PATCH /document-requests — developer marks a request as fulfilled
export async function markDocumentRequestDone(req: Request): Promise<Response> {
  const { id, completedBy } = await req.json();

  if (!id) {
    return Response.json({ error: "Missing id" }, { status: 400 });
  }

  const { data, error } = await supabase
    .schema("portal")
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
