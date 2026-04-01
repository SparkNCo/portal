// @ts-nocheck

import { supabase } from "../client.ts";
import { corsHeaders } from "../utils/headers.ts";
import {
  DeleteDocumentSchema,
  DeleteDocumentResponseSchema,
} from "./zod.ts";

export async function deleteDocument(req: Request) {
  try {
    const body = await req.json();

    const parsedBody = DeleteDocumentSchema.safeParse(body);

    if (!parsedBody.success) {
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

    const { document_id } = parsedBody.data;

    /**
     * ---------------------------------------
     * ✅ DELETE DOCUMENT
     * ---------------------------------------
     */
    const { error } = await supabase
      .from("Document")
      .delete()
      .eq("id", document_id);

    if (error) {
      console.error("[deleteDocument]", error);
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
    const responsePayload = { success: true, document_id };

    const parsedOutput = DeleteDocumentResponseSchema.safeParse(responsePayload);

    if (!parsedOutput.success) {
      console.error(
        "[deleteDocument Response Validation Error]",
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

    return new Response(JSON.stringify(parsedOutput.data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[deleteDocument]", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}
