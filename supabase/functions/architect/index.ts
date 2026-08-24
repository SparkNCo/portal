// @ts-nocheck
import { corsHeaders } from "../utils/headers.ts";
import { prefill } from "./prefill.ts";
import { recommend } from "./recommend.ts";
import { sendReport } from "./send-report.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const pathname = new URL(req.url).pathname;

    if (req.method === "POST" && pathname.endsWith("/prefill")) {
      return await prefill(req);
    }

    if (req.method === "POST" && pathname.endsWith("/recommend")) {
      return await recommend(req);
    }

    if (req.method === "POST" && pathname.endsWith("/send-report")) {
      return await sendReport(req);
    }

    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error("[architect error]", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  }
});
