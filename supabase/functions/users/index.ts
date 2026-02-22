// @ts-nocheck
import { supabase } from "../client.ts";
import { corsHeaders } from "../utils/headers.ts";

Deno.serve(async (req) => {
  // 🔥 CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  try {
    const { searchParams } = new URL(req.url);

    console.log("LLAMA FETCHUSER");

    const email = searchParams.get("email");
    console.log("email", email);

    if (!email) {
      return new Response(
        JSON.stringify({ error: "Email param is required" }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const user = await fetchUser(email);

    return new Response(JSON.stringify(user), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error("[Supabase Error]", error);

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
});

const fetchUser = async (email: string) => {
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("email", email)
    .maybeSingle(); // mejor que single

  if (error) {
    throw new Error(error.message);
  }

  return data;
};
