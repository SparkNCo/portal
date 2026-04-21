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
    const linearName = decodeURIComponent(
      searchParams.get("linear_name") ?? "",
    );

    if (!linearName) {
      return new Response(
        JSON.stringify({ error: "Missing linear_name param" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { data: customer, error: customerError } = await supabase
      .from("users")
      .select("id")
      .eq("linear_slug", linearName)
      .maybeSingle();

    if (customerError)
      throw new Error(`Supabase error: ${customerError.message}`);
    if (!customer) {
      return new Response(
        JSON.stringify({
          error: `No customer found for linear_name: ${linearName}`,
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
      .eq("user_id", customer.id)
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
