// @ts-nocheck

import { supabase } from "../client.ts";
import { corsHeaders } from "../utils/headers.ts";
import {
  UpdateStorageEntryResponseSchema,
  UpdateStorageEntrySchema,
} from "./zod.ts";

export async function updateStorageEntry(req: Request) {
  try {
    const body = await req.json();

    const parsedBody = UpdateStorageEntrySchema.safeParse(body);

    if (!parsedBody.success) {
      return new Response(
        JSON.stringify({
          error: "Invalid request body",
          details: parsedBody.error.flatten(),
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    const { id, user_id, ...updates } = parsedBody.data;

    /**
     * ---------------------------------------
     * 🔒 1. CHECK PERMISSIONS
     * ---------------------------------------
     */
    const { data: permissionData, error: permissionError } = await supabase
      .from("document_permissions")
      .select("permission")
      .eq("user_id", user_id)
      .eq("document_id", id)
      .single();

    if (permissionError || !permissionData) {
      return new Response(
        JSON.stringify({ error: "No permission for this document" }),
        {
          status: 403,
          headers: corsHeaders,
        },
      );
    }

    if (permissionData.permission !== "write") {
      return new Response(
        JSON.stringify({ error: "Write permission required" }),
        {
          status: 403,
          headers: corsHeaders,
        },
      );
    }

    /**
     * ---------------------------------------
     * ✅ 2. UPDATE DOCUMENT
     * ---------------------------------------
     */
    const { data, error } = await supabase
      .from("Document")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("[updateStorageEntry]", error);
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
     * ✅ 3. RESPONSE
     * ---------------------------------------
     */
    const responsePayload = {
      success: true,
      document: data,
    };

    const parsedOutput =
      UpdateStorageEntryResponseSchema.safeParse(responsePayload);

    if (!parsedOutput.success) {
      console.error(
        "[Update Response Validation Error]",
        parsedOutput.error.flatten(),
      );

      return new Response(
        JSON.stringify({ error: "Invalid response format" }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    return new Response(JSON.stringify(parsedOutput.data), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error("[updateStorageEntry]", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  }
}
