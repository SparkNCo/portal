// @ts-nocheck
import { supabase } from "../client.ts";
import { corsHeaders } from "../utils/headers.ts";
import { GetStorageDataResponseSchema } from "./zod.ts";

export async function getStorageData(req: Request) {
  try {
    /**
     * ---------------------------------------
     * ✅ 1. Read initiative_id from request
     * ---------------------------------------
     */
    const { searchParams } = new URL(req.url);

    const initiative_id = searchParams.get("initiative_id");

    if (!initiative_id) {
      return new Response(
        JSON.stringify({ error: "initiative_id is required" }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    const category = searchParams.get("category") ?? undefined;

    /**
     * ---------------------------------------
     * ✅ 2. Query Documents
     * ---------------------------------------
     */
    let query = supabase
      .from("Document")
      .select("*")
      .eq("initiative_id", initiative_id)
      .order("created_at", { ascending: false });

    if (category) {
      query = query.eq("category", category);
    }

    const { data, error } = await query;

    if (error) {
      console.error("[Get Documents Error]", error);

      return new Response(
        JSON.stringify({ error: error.message }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    /**
     * ---------------------------------------
     * ✅ 3. Build response
     * ---------------------------------------
     */
    const responsePayload = {
      success: true,
      count: data.length,
      documents: data,
    };

    const parsedOutput =
      GetStorageDataResponseSchema.safeParse(responsePayload);

    if (!parsedOutput.success) {
      console.error(
        "[Response Validation Error]",
        parsedOutput.error.flatten()
      );

      return new Response(
        JSON.stringify({ error: "Invalid response format" }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    return new Response(JSON.stringify(parsedOutput.data), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });

  } catch (error) {
    console.error("[getStorageData]", error);

    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
}