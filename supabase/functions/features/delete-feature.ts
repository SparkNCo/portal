// @ts-nocheck
import { supabase } from "../client.ts";
import { corsHeaders } from "../utils/headers.ts";
import { DeleteQuerySchema } from "./zod.ts";

export async function deleteFeature(req: Request): Promise<Response> {
  try {
    const url = new URL(req.url);

    const parsedQuery = DeleteQuerySchema.safeParse({
      id: url.searchParams.get("id"),
    });

    if (!parsedQuery.success) {
      return new Response(
        JSON.stringify({
          error: "Invalid query params",
          details: parsedQuery.error.flatten(),
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        },
      );
    }

    const { id } = parsedQuery.data;

    const { error, count } = await supabase.schema("marketing")
      .from("requirements")
      .delete({ count: "exact" })
      .eq("id", id);

    if (error) {
      console.error("[delete-feature] Supabase error:", error);
      return new Response(JSON.stringify({ error: "Failed to delete feature" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (!count) {
      return new Response(JSON.stringify({ error: "Feature not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    return new Response(JSON.stringify({ deleted: id }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (err) {
    console.error("[delete-feature] Unexpected error:", err);

    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
}
