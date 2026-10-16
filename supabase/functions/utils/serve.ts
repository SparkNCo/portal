// @ts-nocheck
import { corsHeaders } from "./headers.ts";
import { TestModeRejected } from "../lib/testMode.ts";

// Wraps a Deno.serve handler with the shared CORS preflight, response-wrapping,
// and error-handling boilerplate used by every edge function's index.ts.
export function serveWithCors(logTag: string, router: (req: Request) => Promise<Response>) {
  Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    try {
      const res = await router(req);
      return new Response(res.body, {
        status: res.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (error) {
      // A test-mode header that can't be honoured (lib/testMode.ts).
      const status = error instanceof TestModeRejected ? 403 : 500;
      if (status === 500) console.error(`[${logTag}]`, error);
      return new Response(JSON.stringify({ error: error.message }), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  });
}
