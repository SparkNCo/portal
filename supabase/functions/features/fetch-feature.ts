// fetch-features.ts
// @ts-nocheck
import { supabase } from "../client.ts";
import { corsHeaders } from "../utils/headers.ts";
import { FeaturesSchema, QuerySchema } from "./zod.ts";

export async function fetchFeatures(req: Request): Promise<Response> {
  try {
    const url = new URL(req.url);

    // ✅ Validate query params
    const parsedQuery = QuerySchema.safeParse({
      submission_id: url.searchParams.get("submission_id"),
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
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        },
      );
    }

    const { submission_id } = parsedQuery.data;

    const { data, error } = await supabase
      .from("requirements")
      .select(
        `
        id,
        proposal_id,
        submission_id,
        feature_name,
        description,
        purpose,
        integration_text,
        tech_constraints,
        created_at
      `,
      )
      .eq("submission_id", submission_id)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[fetch-features] Supabase error:", error);
      return new Response(
        JSON.stringify({ error: "Failed to fetch features" }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        },
      );
    }

    // ✅ Validate DB response
    const parsedData = FeaturesSchema.safeParse(data ?? []);

    if (!parsedData.success) {
      console.error("[fetch-features] Invalid DB shape:", parsedData.error);

      return new Response(
        JSON.stringify({ error: "Invalid data returned from database" }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        },
      );
    }

    return new Response(JSON.stringify(parsedData.data), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (err) {
    console.error("[fetch-features] Unexpected error:", err);

    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  }
}
