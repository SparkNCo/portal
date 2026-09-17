// @ts-nocheck
import { supabase } from "../client.ts";
import { corsHeaders } from "../utils/headers.ts";

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
    const documents = (data || []).map((doc) => ({
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
