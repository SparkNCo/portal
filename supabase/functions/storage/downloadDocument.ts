// @ts-nocheck
import { supabase } from "../client.ts";
import { corsHeaders } from "../utils/headers.ts";

function extractPathFromUrl(url: string) {
  const marker = "/documents_bucket/";
  const index = url.indexOf(marker);

  if (index === -1) return null;

  return url.substring(index + marker.length);
}

export async function downloadDocument(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const document_id = searchParams.get("document_id");
    const user_id = searchParams.get("user_id");
    const inline = searchParams.get("inline") === "true";
    console.log("document_id:", document_id);
    console.log("user_id:", user_id);

    if (!document_id || !user_id) {
      return new Response(
        JSON.stringify({ error: "document_id and user_id are required" }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    // const { data: permissionData, error: permissionError } = await supabase
    //   .from("document_permissions")
    //   .select("permission")
    //   .eq("user_id", user_id)
    //   .eq("document_id", document_id)
    //   .single();

    // if (permissionError || !permissionData) {
    //   return new Response(JSON.stringify({ error: "No access" }), {
    //     status: 403,
    //     headers: corsHeaders,
    //   });
    // }

    // if (!["read", "write"].includes(permissionData.permission)) {
    //   return new Response(JSON.stringify({ error: "Unauthorized" }), {
    //     status: 403,
    //     headers: corsHeaders,
    //   });
    // }

    /**
     * ---------------------------------------
     * ✅ 2. Get document (using link)
     * ---------------------------------------
     */

    console.log("Document id:", document_id);

    const { data: document, error: docError } = await supabase
      .from("Document")
      .select("link")
      .eq("id", Number(document_id))
      .single();

    if (docError || !document) {
      return new Response(JSON.stringify({ error: "Document not found" }), {
        status: 404,
        headers: corsHeaders,
      });
    }

    /**
     * ---------------------------------------
     * ✅ 3. Extract path
     * ---------------------------------------
     */
    console.log("Document link:", document.link);

    const path = extractPathFromUrl(document.link);

    if (!path) {
      return new Response(JSON.stringify({ error: "Invalid file path" }), {
        status: 500,
        headers: corsHeaders,
      });
    }
    /**
     * ---------------------------------------
     * ✅ 4. Generate signed URL
     * ---------------------------------------
     */
    const { data: signedUrlData, error: signedError } = await supabase.storage
      .from("documents_bucket")
      .createSignedUrl(path, 300, ...(inline ? [] : [{ download: true }]));

    if (signedError) {
      return new Response(JSON.stringify({ error: signedError.message }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    /**
     * ---------------------------------------
     * ✅ 5. Return URL
     * ---------------------------------------
     */
    return new Response(JSON.stringify({ url: signedUrlData.signedUrl }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error("[downloadDocument]", error);

    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
}
