// @ts-nocheck
import { supabase } from "../client.ts";
import { corsHeaders } from "../utils/headers.ts";

export async function getStorageData(req: Request) {
  try {
    /**
     * ---------------------------------------
     * ✅ 1. Read params
     * ---------------------------------------
     */
    const { searchParams } = new URL(req.url);

    const user_id = searchParams.get("user_id");
    const category = searchParams.get("category") ?? undefined;

    if (!user_id) {
      return new Response(JSON.stringify({ error: "user_id is required" }), {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      });
    }


    let query = supabase
      .from("document_permissions")
      .select(
        `
        permission,
        Document (
          id,
          file_name,
          link,
          category,
          size,
          created_at,
          initiative_id
        )
      `,
      )
      .eq("user_id", user_id)
      .order("created_at", { foreignTable: "Document", ascending: false });

    if (category) {
      query = query.eq("Document.category", category);
    }

    const { data, error } = await query;
    console.log("RAW DATA:", JSON.stringify(data, null, 2));
    if (error) {
      console.error("[Get Documents Error]", error);

      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      });
    }

    /**
     * ---------------------------------------
     * ✅ 3. Flatten result
     * ---------------------------------------
     */
    const documents = (data || [])
      .filter((item) => item.Document) // 🔥 avoid null joins
      .map((item) => ({
        id: item.Document.id,
        file_name: item.Document.file_name,
        link: item.Document.link,
        category: item.Document.category,
        size: item.Document.size,
        created_at: item.Document.created_at,
        initiative_id: item.Document.initiative_id,
        permission: item.permission,
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
