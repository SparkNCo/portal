// @ts-nocheck
import { supabase } from "../client.ts";

// POST /document-requests — stakeholder asks for a report/technical document
export async function createDocumentRequest(req: Request, schema: string): Promise<Response> {
  const { customerSlug, requestedBy, title, description, projectId, projectName, relatedRequestId } =
    await req.json();

  if (!customerSlug || !requestedBy || !title) {
    return Response.json(
      { error: "Missing customerSlug, requestedBy, or title" },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .schema(schema)
    .from("document_requests")
    .insert({
      customer_slug: customerSlug,
      requested_by: requestedBy,
      title: String(title).trim(),
      description: description ?? null,
      project_id: projectId ?? null,
      project_name: projectName ?? null,
      related_request_id: relatedRequestId ?? null,
    })
    .select()
    .single();

  if (error) {
    return Response.json(
      { error: "Failed to create document request", details: error.message },
      { status: 500 },
    );
  }

  return Response.json(data);
}
