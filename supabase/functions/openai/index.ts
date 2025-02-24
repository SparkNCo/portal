import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { GPTResponseBody } from "../_shared/types.ts";
import { getErrorMessage } from "../_shared/helpers.ts";
// const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
import axios from "npm:axios";

const OPENAI_API_KEY =
  "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";
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body: GPTResponseBody = await req.json();
    const { data } = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      body,
      {
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 240000,
      },
    );
    return new Response(
      JSON.stringify({
        // message: data.choices[0]?.message?.content,
        data,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    console.error("Error:", errorMessage);
    return new Response(
      JSON.stringify({
        error:
          "There was an error while processing your request. Please try again later.",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      },
    );
  }
});
