// @ts-nocheck
import { supabase } from "../client.ts";
import { corsHeaders } from "../utils/headers.ts";
import {
  GetStorageDataQuerySchema,
  GetStorageDataResponseSchema,
} from "./zod.ts";

export async function getStorageData(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const parsedQuery = GetStorageDataQuerySchema.safeParse({
      user_id: searchParams.get("user_id"),
      category: searchParams.get("category") ?? undefined,
    });

    if (!parsedQuery.success) {
      return new Response(
        JSON.stringify({
          error: "Invalid query params",
          details: parsedQuery.error.flatten(),
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

    const { user_id } = parsedQuery.data;
    console.log("checking supabase");

    let query = supabase
      .from("Document")
      .select("*")
      .eq("owner_id", user_id)
      .order("created_at", { ascending: false });

    const { data, error } = await query;

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

    const responsePayload = {
      success: true,
      count: data.length,
      documents: data,
    };
    console.log("responsePayload", responsePayload);

    const parsedOutput =
      GetStorageDataResponseSchema.safeParse(responsePayload);

    if (!parsedOutput.success) {
      console.error(
        "[Response Validation Error]",
        parsedOutput.error.flatten(),
      );

      return new Response(
        JSON.stringify({
          error: "Invalid response format",
        }),
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
