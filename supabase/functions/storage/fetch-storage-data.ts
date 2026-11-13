// @ts-nocheck
import { supabase } from "../client.ts";
import { corsHeaders } from "../utils/headers.ts";
import { queryTopDocumentMatches } from "../lib/vector.ts";
import { userInitiativeSlugs } from "./access.ts";

export async function getStorageData(req: Request, schema: string) {
  try {
    // 1. Read params
    const { searchParams } = new URL(req.url);

    const user_id = searchParams.get("user_id");
    const category = searchParams.get("category") ?? undefined;
    const project_slug = searchParams.get("project_slug") ?? undefined;
    // Vector search needs project_slug as namespace; without it, falls back
    // to a plain substring filter.
    const search = searchParams.get("search")?.trim() || undefined;
    // The logged-in caller. `user_id` is whose permissions to scope by (the
    // previewed customer when an admin/developer browses their dashboard).
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

    // 1. Get permissions (also in admin full view, to show each doc's real permission).
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
    // Initiatives the user is on: their initiative_wide documents count as
    // theirs too (storage/access.ts).
    const initiativeSlugs = await userInitiativeSlugs(schema, user_id);
    const memberOf = (slug: string | null | undefined) => !!slug && initiativeSlugs.includes(slug.toLowerCase());

    // Admins see every document in the initiative (by project_slug), not just
    // permitted ones. Requires project_slug so it's never platform-wide.
    const adminFullView = viewerIsAdmin && !!project_slug;

    if (!adminFullView && !permissions?.length && initiativeSlugs.length === 0) {
      return new Response(JSON.stringify({ success: true, count: 0, documents: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Fetch the actual documents
    let docQuery = supabase.schema(schema)
      .from("documents")
      .select("id, file_name, link, category, size, created_at, project_slug, initiative_wide")
      // Soft-deleted documents are gone for everyone.
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (!adminFullView) {
      // Documents they were given, or initiative_wide ones of their
      // initiatives (matched case-insensitively below).
      const ids = (permissions ?? []).map((p) => p.document_id);
      const filters = [
        ...(ids.length ? [`id.in.(${ids.join(",")})`] : []),
        ...(initiativeSlugs.length ? ["initiative_wide.eq.true"] : []),
      ];
      docQuery = docQuery.or(filters.join(","));
    }

    if (category) {
      docQuery = docQuery.eq("category", category);
    }

    if (project_slug) {
      // Stored slugs have mixed casing that can't be backfilled; ilike without
      // wildcards = case-insensitive equality.
      docQuery = docQuery.ilike("project_slug", project_slug);
    }

    const { data, error } = await docQuery;
    if (error) {
      console.error("[Get Documents Error]", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Flatten result. initiative_wide documents of other initiatives came
    // back with the broad filter above; keep only the user's own.
    let documents = (data || [])
      .filter((doc) => adminFullView || permissionMap.has(doc.id) || (doc.initiative_wide && memberOf(doc.project_slug)))
      .map((doc) => ({
      id: doc.id,
      file_name: doc.file_name,
      link: doc.link,
      category: doc.category,
      size: doc.size,
      created_at: doc.created_at,
      project_slug: doc.project_slug,
      // "access" when the user has access (there's no owner / write / read
      // any more); null in an admin's full view of documents they weren't
      // given (admins can act on them anyway).
      permission: permissionMap.has(doc.id) || (doc.initiative_wide && memberOf(doc.project_slug)) ? "access" : null,
    }));

    // 3b. AI search — only re-orders/filters the permitted set above,
    // never surfaces a document outside it.
    if (search && project_slug) {
      // Without a cutoff every document comes back, just reordered.
      // Calibrated on pgvector/gte-small, which packs scores into a narrow
      // high band (unrelated short docs scored ~0.8); rough — revisit with
      // more varied data.
      const MIN_DOCUMENT_SIMILARITY = 0.8;
      const allMatches = await queryTopDocumentMatches(project_slug, search, documents.length || 20);
      const matches = allMatches.filter((m) => m.score >= MIN_DOCUMENT_SIMILARITY);
      const rank = new Map(matches.map((m, i) => [String(m.id), i]));
      const byId = new Map(documents.map((d) => [String(d.id), d]));

      const ranked = matches
        .map((m) => byId.get(String(m.id)))
        .filter((d): d is (typeof documents)[number] => Boolean(d));

      // Substring fallback for documents the index misses (e.g. not yet backfilled).
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

    // 4. Response (no validation)
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
