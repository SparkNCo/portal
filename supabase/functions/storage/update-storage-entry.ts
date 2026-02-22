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

    const { id, ...updates } = parsedBody.data;

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
