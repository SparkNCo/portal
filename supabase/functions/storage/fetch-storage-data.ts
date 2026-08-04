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

    if (!user_id) {
      return new Response(JSON.stringify({ error: "user_id is required" }), {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      });
    }


    // 1. Get permissions for this user
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

    if (!permissions?.length) {
      return new Response(JSON.stringify({ success: true, count: 0, documents: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const documentIds = permissions.map((p) => p.document_id);
    const permissionMap = new Map(permissions.map((p) => [p.document_id, p.permission]));

    // 2. Fetch the actual documents
    let docQuery = supabase.schema(schema)
      .from("documents")
      .select("id, file_name, link, category, size, created_at, project_slug")
      .in("id", documentIds)
      .order("created_at", { ascending: false });

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
