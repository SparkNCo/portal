// @ts-nocheck
import { supabase } from "../client.ts";
import { corsHeaders } from "../utils/headers.ts";
import { EMBED_WORDS_PER_CALL, embedDocument } from "../lib/vector.ts";
import { extractDocumentText, isSearchableDocumentFormat } from "../utils/documentText.ts";

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
  if (index === -1) return null;
  // Public URLs are percent-encoded ("My%20Doc.docx"); storage wants the real name.
  const path = url.substring(index + marker.length);
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
}

// Embedding is CPU-heavy (gte-small runs in-process): one call embeds up to
// EMBED_WORDS_PER_CALL words, across as many documents as that covers (only
// their new or changed chunks), then stops. A long document is finished over
// several calls. Call again until `remaining` is 0.
const BATCH_SIZE = 25;

// POST /storage/backfill-vectors { user_id, project_slug?, all?, after_id? } —
// admin-only. By default finishes documents whose chunks aren't all embedded
// (documents.embeddings_complete = false: uploaded before chunks existed, or
// too long to finish on upload). `all: true` re-checks every document instead
// (e.g. after a change to what gets extracted; unchanged chunks keep their
// vectors): pass the returned `next_after_id` back as `after_id` until it
// comes back null. Best-effort per document — one bad file (e.g. a dead
// storage link) is logged and counted, not thrown.
export async function backfillDocumentVectors(req: Request, schema: string) {
  try {
    const { user_id, project_slug, all = false, after_id } = await req.json();

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
      .select("id, file_name, category, link, project_slug", { count: "exact" })
      .not("project_slug", "is", null)
      .order("id", { ascending: true })
      .limit(BATCH_SIZE);
    if (project_slug) query = query.ilike("project_slug", project_slug);
    if (all) {
      if (after_id != null) query = query.gt("id", after_id);
    } else {
      query = query.eq("embeddings_complete", false);
    }

    const { data: documents, error, count } = await query;
    if (error) throw new Error(error.message);

    let vectorized = 0;
    let failed = 0;
    let processed = 0;
    let budget = EMBED_WORDS_PER_CALL;
    // `all` mode: the last document this call finished (or gave up on), so the
    // next call resumes right after it — an unfinished one is picked up again.
    let resumeAfter = after_id ?? null;
    let stoppedMidway = false;

    for (const doc of documents ?? []) {
      if (budget <= 0) {
        stoppedMidway = true;
        break;
      }
      processed++;
      try {
        let content: string | null = null;
        if (isSearchableDocumentFormat(doc.file_name)) {
          const path = extractStoragePath(doc.link);
          if (path) {
            const { data: blob } = await supabase.storage.from(BUCKET).download(path);
            if (blob) content = await extractDocumentText(doc.file_name, blob);
          }
        }
        const { complete, wordsUsed } = await embedDocument(
          doc.project_slug,
          { id: doc.id, file_name: doc.file_name, category: doc.category, content },
          budget,
        );
        budget -= wordsUsed;
        if (!complete) {
          stoppedMidway = true;
          break;
        }
        vectorized++;
        resumeAfter = doc.id;
      } catch (err) {
        console.error(`[backfillDocumentVectors] document ${doc.id} failed:`, err);
        failed++;
        resumeAfter = doc.id;
      }
    }

    // `count` = rows matching before this batch ran. Unfinished documents stay
    // in the count until a later call completes them.
    const remaining = all
      ? Math.max((count ?? 0) - vectorized - failed, 0)
      : Math.max((count ?? 0) - vectorized, 0);
    const moreToGo = stoppedMidway || (documents?.length ?? 0) === BATCH_SIZE;
    // null means "done", so a call that couldn't finish even its first
    // document resumes from the start (ids are positive: `id > 0` is every one).
    const next_after_id = all && moreToGo ? (resumeAfter ?? 0) : null;

    return new Response(
      JSON.stringify({ success: true, vectorized, failed, remaining, next_after_id }),
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
