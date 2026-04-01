// @ts-nocheck

import { supabase } from "../client.ts";
import { corsHeaders } from "../utils/headers.ts";
import {
  UpdateDocumentCategorySchema,
  UpdateDocumentCategoryResponseSchema,
} from "./zod.ts";

export async function updateDocumentCategory(req: Request) {
  console.log("[updateDocumentCategory] 🚀 Incoming request");

  try {
    const body = await req.json();
    console.log("[updateDocumentCategory] 📥 Raw body:", body);

    const parsedBody = UpdateDocumentCategorySchema.safeParse(body);

    if (!parsedBody.success) {
      console.error(
        "[updateDocumentCategory] ❌ Invalid body:",
        parsedBody.error.flatten(),
      );

      return new Response(
        JSON.stringify({
          error: "Invalid request body",
          details: parsedBody.error.flatten(),
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    console.log("[updateDocumentCategory] ✅ Body parsed successfully");

    const { document_id, category } = parsedBody.data;

    console.log("[updateDocumentCategory] 🔍 Extracted values:", {
      document_id,
      category,
    });

    /**
     * ---------------------------------------
     * ✅ UPDATE DOCUMENT CATEGORY
     * ---------------------------------------
     */
    console.log("[updateDocumentCategory] 📝 Updating category...", {
      document_id,
      category,
    });

    const { data, error } = await supabase
      .from("Document")
      .update({ category })
      .eq("id", document_id)
      .select()
      .single();

    console.log("[updateDocumentCategory] 📝 Update result:", {
      data,
      error,
    });

    if (error) {
      console.error("[updateDocumentCategory] ❌ Update error:", error);

      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    /**
     * ---------------------------------------
     * ✅ RESPONSE
     * ---------------------------------------
     */
    const responsePayload = { success: true, document: data };

    console.log(
      "[updateDocumentCategory] 📤 Response payload:",
      responsePayload,
    );

    const parsedOutput =
      UpdateDocumentCategoryResponseSchema.safeParse(responsePayload);

    if (!parsedOutput.success) {
      console.error(
        "[updateDocumentCategory] ❌ Response validation error:",
        parsedOutput.error.flatten(),
      );

      return new Response(
        JSON.stringify({ error: "Invalid response format" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    console.log("[updateDocumentCategory] ✅ Response validated successfully");

    return new Response(JSON.stringify(parsedOutput.data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[updateDocumentCategory] 💥 Unexpected error:", error);

    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}
