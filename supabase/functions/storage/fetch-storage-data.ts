// @ts-nocheck
import { supabase } from "../client.ts";
import { corsHeaders } from "../utils/headers.ts";
import { queryTopDocumentMatches } from "../lib/vector.ts";

export async function getStorageData(req: Request, schema: string) {
  try {
    /**
     * ---------------------------------------
     * ✅ 1. Read params
     * ---------------------------------------
     */
    const { searchParams } = new URL(req.url);

    const user_id = searchParams.get("user_id");
    const category = searchParams.get("category") ?? undefined;
    const project_slug = searchParams.get("project_slug") ?? undefined;
    // SPA-513-Cycle20: AI document search — free-text query, matched against
    // each document's vectorized title/category/content (see
    // upsertDocumentVector). Needs project_slug as the vector namespace;
    // without one there's nothing to search against and this silently no-ops
    // below rather than erroring, so the panel still just shows everything.
    const search = searchParams.get("search")?.trim() || undefined;
    // The actual logged-in caller — distinct from `user_id` above, which is
    // *whose* document_permissions rows to scope by (the previewed customer,
    // when an admin/developer is browsing someone else's dashboard — see
    // usePinnedPanelsOwnerId). Without this, the backend never learns who's
    // really asking, so an admin previewing a customer was stuck seeing only
    // documents that customer specifically has a permission row for — the
    // same blind spot as everyone else, despite being an admin.
    const viewer_id = searchParams.get("viewer_id") ?? undefined;

    if (!user_id) {
      return new Response(JSON.stringify({ error: "user_id is required" }), {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      });
    }

    let viewerIsAdmin = false;
    if (viewer_id) {
      const { data: viewer } = await supabase.schema(schema)
        .from("users")
        .select("role")
        .eq("id", viewer_id)
        .maybeSingle();
      viewerIsAdmin = viewer?.role === "admin";
    }

    // 1. Get permissions for this user (still fetched even for an admin's
    // full-initiative view below, so each document can still show whatever
    // real permission — if any — the previewed user/admin actually has).
    const { data: permissions, error: permError } = await supabase.schema(schema)
      .from("document_permissions")
      .select("document_id, permission")
      .eq("user_id", user_id);

    if (permError) {
      console.error("[Get Permissions Error]", permError);
      return new Response(JSON.stringify({ error: permError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const permissionMap = new Map((permissions ?? []).map((p) => [p.document_id, p.permission]));

    // Admins previewing an initiative see *every* document filed under it,
    // not just the ones the previewed user happens to have a permission row
    // for — scoped by project_slug instead of document_permissions. Requires
    // project_slug (an unscoped "every document on the platform" query isn't
    // what was asked for); everyone else keeps the permission-scoped list.
    const adminFullView = viewerIsAdmin && !!project_slug;

    if (!adminFullView && !permissions?.length) {
      return new Response(JSON.stringify({ success: true, count: 0, documents: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Fetch the actual documents
    let docQuery = supabase.schema(schema)
      .from("documents")
      .select("id, file_name, link, category, size, created_at, project_slug")
      .order("created_at", { ascending: false });

    if (!adminFullView) {
      docQuery = docQuery.in("id", permissions.map((p) => p.document_id));
    }

    if (category) {
      docQuery = docQuery.eq("category", category);
    }

    if (project_slug) {
      // customers.linear_slug (the source of documents.project_slug at
      // upload time) has inconsistent casing for some real customers that
      // can't be backfilled — exact .eq() here made a developer's Project
      // Documents panel come up empty whenever their resolved project slug
      // differed only in case from what's stored. ilike (no wildcards) is
      // case-insensitive equality in Postgres.
      docQuery = docQuery.ilike("project_slug", project_slug);
    }

    const { data, error } = await docQuery;
    console.log("RAW DATA:", JSON.stringify(data, null, 2));
    if (error) {
      console.error("[Get Documents Error]", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    /**
     * ---------------------------------------
     * ✅ 3. Flatten result
     * ---------------------------------------
     */
    let documents = (data || []).map((doc) => ({
      id: doc.id,
      file_name: doc.file_name,
      link: doc.link,
      category: doc.category,
      size: doc.size,
      created_at: doc.created_at,
      project_slug: doc.project_slug,
      permission: permissionMap.get(doc.id) ?? null,
    }));

    /**
     * ---------------------------------------
     * ✅ 3b. AI search — rank by vector similarity, keeping every document
     * this caller already has permission to see (queried above) as the
     * universe; the vector index is only ever used to re-order/filter that
     * set, never to surface a document outside it.
     * ---------------------------------------
     */
    if (search && project_slug) {
      // Un-thresholded, `queryTopDocumentMatches` just returns every
      // vectorized document ranked by similarity, up to `documents.length`
      // — with only a handful of documents in a project, that's "return
      // everything, just reordered," so any two searches look like they hit
      // the same result set regardless of relevance. This cutoff drops
      // genuinely-unrelated matches instead of always filling out the list.
      //
      // Calibrated against real pgvector/gte-small scores (not Upstash's
      // mxbai-embed-large-v1, which may score differently): 4 short/similar
      // technical documents (CSVs/mmd about the same test dataset) scored
      // 0.79-0.82 for an unrelated-ish query — gte-small compresses cosine
      // similarity into a narrow high band for short domain-specific text,
      // so a loose floor like 0.3 never cuts anything. 0.8 is still a rough
      // first pass, not a universal constant — revisit if a genuinely
      // varied document set still over- or under-matches.
      const MIN_DOCUMENT_SIMILARITY = 0.8;
      const allMatches = await queryTopDocumentMatches(project_slug, search, documents.length || 20);
      const matches = allMatches.filter((m) => m.score >= MIN_DOCUMENT_SIMILARITY);
      const rank = new Map(matches.map((m, i) => [String(m.id), i]));
      const byId = new Map(documents.map((d) => [String(d.id), d]));

      const ranked = matches
        .map((m) => byId.get(String(m.id)))
        .filter((d): d is (typeof documents)[number] => Boolean(d));

      // The vector index can miss a real filename/category match (e.g. a
      // document uploaded before this feature existed, or one whose content
      // extraction wasn't available) — falling back to a plain substring
      // check over whatever the ranked results didn't already cover keeps
      // search from silently regressing to "no results" for those.
      const searchLower = search.toLowerCase();
      const keywordFallback = documents.filter(
        (d) =>
          !rank.has(String(d.id)) &&
          (d.file_name?.toLowerCase().includes(searchLower) ||
            d.category?.toLowerCase().includes(searchLower)),
      );

      documents = [...ranked, ...keywordFallback];
    } else if (search) {
      const searchLower = search.toLowerCase();
      documents = documents.filter(
        (d) =>
          d.file_name?.toLowerCase().includes(searchLower) ||
          d.category?.toLowerCase().includes(searchLower),
      );
    }

    /**
     * ---------------------------------------
     * ✅ 4. Response (no validation)
     * ---------------------------------------
     */
    return new Response(
      JSON.stringify({
        success: true,
        count: documents.length,
        documents,
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  } catch (error) {
    console.error("[getStorageData]", error);

    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  }
}
