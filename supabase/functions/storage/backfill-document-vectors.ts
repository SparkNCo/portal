// @ts-nocheck
import { supabase } from "../client.ts";
import { corsHeaders } from "../utils/headers.ts";
import { upsertDocumentVector } from "../lib/vector.ts";
import { isTextDocumentFormat, truncateDocumentContent } from "../utils/documentText.ts";

const BUCKET = "documents_bucket";

// documents.link is a getPublicUrl() result (see upload-storage-data.ts),
// but the bucket itself is private — downloadDocument.ts has to exchange it
// for a signed URL before it's actually fetchable. This backend already has
// direct storage access via the service-role client, so it's simpler (and
// doesn't burn a signed-URL round trip per document) to just extract the
// object path and read it straight from storage instead.
function extractStoragePath(url: string): string | null {
  const marker = `/${BUCKET}/`;
  const index = url.indexOf(marker);
  return index === -1 ? null : url.substring(index + marker.length);
}

// SPA-513-Cycle20: AI document search only vectorizes a document going
// forward (see upload-storage-data.ts) — anything uploaded before that
// shipped has no vector yet and won't turn up in search until someone
// re-uploads it. Admin-only, one-shot backfill: walks every document (all
// projects, or one via `project_slug`) and vectorizes it. Best-effort per
// document — one bad file (e.g. a dead storage link) shouldn't abort the
// whole run, so failures are logged and counted, not thrown.
export async function backfillDocumentVectors(req: Request, schema: string) {
  try {
    const { user_id, project_slug } = await req.json();

    if (!user_id) {
      return new Response(JSON.stringify({ error: "user_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: caller } = await supabase.schema(schema)
      .from("users")
      .select("role")
      .eq("id", user_id)
      .maybeSingle();
    if (caller?.role !== "admin") {
      return new Response(JSON.stringify({ error: "Admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let query = supabase.schema(schema)
      .from("documents")
      .select("id, file_name, category, link, project_slug")
      .not("project_slug", "is", null);
    if (project_slug) query = query.ilike("project_slug", project_slug);

    const { data: documents, error } = await query;
    if (error) throw new Error(error.message);

    let vectorized = 0;
    let failed = 0;

    for (const doc of documents ?? []) {
      try {
        let content: string | null = null;
        if (isTextDocumentFormat(doc.file_name)) {
          const path = extractStoragePath(doc.link);
          if (path) {
            const { data: blob } = await supabase.storage.from(BUCKET).download(path);
            if (blob) content = truncateDocumentContent(await blob.text());
          }
        }
        const ok = await upsertDocumentVector(doc.project_slug, {
          id: doc.id,
          file_name: doc.file_name,
          category: doc.category,
          content,
        });
        if (ok) vectorized++;
        else failed++;
      } catch (err) {
        console.error(`[backfillDocumentVectors] document ${doc.id} failed:`, err);
        failed++;
      }
    }
    return new Response(
      JSON.stringify({ success: true, total: documents?.length ?? 0, vectorized, failed }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[backfillDocumentVectors]", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}
