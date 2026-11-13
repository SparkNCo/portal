// @ts-nocheck
// DELETE /storage { document_id, user_id } — soft delete. Anyone with access
// to the document (or an admin) can delete it. The document is only marked
// deleted (deleted_at / deleted_by): the file stays in documents_bucket, and
// the row and its permissions stay, so it could be restored. Its search
// vectors are removed, so search and "Ask about this project" stop finding it.
import { supabase } from "../client.ts";
import { deleteDocumentVectors } from "../lib/vector.ts";
import { DeleteDocumentSchema } from "./zod.ts";
import { hasDocumentAccess, jsonResponse } from "./access.ts";

export async function deleteDocument(req: Request, schema: string) {
  try {
    const parsedBody = DeleteDocumentSchema.safeParse(await req.json());
    if (!parsedBody.success) {
      return jsonResponse({ error: "Invalid request body", details: parsedBody.error.flatten() }, 400);
    }
    const { document_id, user_id } = parsedBody.data;

    if (!(await hasDocumentAccess(schema, user_id, document_id))) {
      return jsonResponse({ error: "No access" }, 403);
    }

    const { data: deleted, error } = await supabase.schema(schema)
      .from("documents")
      .update({ deleted_at: new Date().toISOString(), deleted_by: user_id })
      .eq("id", document_id)
      .is("deleted_at", null)
      .select("project_slug")
      .maybeSingle();
    if (error) {
      console.error("[deleteDocument]", error);
      return jsonResponse({ error: error.message }, 500);
    }
    if (!deleted) return jsonResponse({ error: "Document not found" }, 404);

    // Best-effort: a leftover vector is harmless (lists and Ask skip deleted
    // documents anyway).
    if (deleted.project_slug && typeof EdgeRuntime !== "undefined") {
      EdgeRuntime.waitUntil(deleteDocumentVectors(deleted.project_slug, [document_id]));
    }

    return jsonResponse({ success: true, document_id });
  } catch (error) {
    console.error("[deleteDocument]", error);
    return jsonResponse({ error: error.message }, 500);
  }
}
