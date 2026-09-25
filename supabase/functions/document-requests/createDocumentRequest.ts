// @ts-nocheck
import { supabase } from "../client.ts";
import { notifyProject, resolveDocumentsLink } from "../utils/notify.ts";

// POST /document-requests — customer/stakeholder/admin asks for a report/technical document
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

  // notifyProject already fans out to the developers/stakeholders assigned
  // to this project plus every admin, minus whoever triggered it — exactly
  // "notify developers, and notify admins too when it's not one of them
  // asking". Fire-and-forget so it doesn't hold up the response.
  EdgeRuntime.waitUntil(notifyProject({
    slug: customerSlug,
    actorEmail: requestedBy,
    action: "document_request_created",
    objectType: "document_request",
    objectId: String(data.id),
    link: resolveDocumentsLink(customerSlug),
    preview: String(title).trim(),
    objectTitle: String(title).trim(),
  }));

  return Response.json(data);
}
