// @ts-nocheck
import { corsHeaders } from "../utils/headers.ts";
import { supabase } from "../client.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
    const { searchParams } = new URL(req.url);
    const userName = decodeURIComponent(searchParams.get("linear_name") ?? "");

    if (!userName) {
      return new Response(JSON.stringify({ error: "Missing userName param" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: userRow, error: userError } = await supabase
      .from("users")
      .select("linear_slug")
      .eq("clientName", userName)
      .maybeSingle();

    if (userError) throw new Error(`User lookup error: ${userError.message}`);
    if (!userRow?.linear_slug) {
      return new Response(
        JSON.stringify({
          error: `No linear_slug found for userName: ${userName}`,
        }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { data, error } = await supabase
      .from("dorametrics")
      .select("*")
      .eq("linear_slug", userRow.linear_slug)
      .order("created_at", { ascending: false });

    if (error) throw new Error(`Supabase error: ${error.message}`);

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
