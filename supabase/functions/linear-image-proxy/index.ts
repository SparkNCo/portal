// @ts-nocheck
import { corsHeaders } from "../utils/headers.ts";

const LINEAR_API_KEY = Deno.env.get("LINEAR_API_KEY")!;

// Linear-hosted issue attachments require the workspace's own API key to
// read, not the viewer's session — portal users never have a Linear
// account, so their browser can't fetch these directly. This proxies the
// request through our backend using our own key instead. Restricted to
// Linear's upload host so it can't be used as an open image proxy.
const ALLOWED_HOST = "uploads.linear.app";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  const { searchParams } = new URL(req.url);
  const target = searchParams.get("url");

  if (!target) {
    return new Response("Missing url", { status: 400, headers: corsHeaders });
  }

  let targetUrl: URL;
  try {
    targetUrl = new URL(target);
  } catch {
    return new Response("Invalid url", { status: 400, headers: corsHeaders });
  }

  if (targetUrl.hostname !== ALLOWED_HOST) {
    return new Response("Forbidden host", { status: 403, headers: corsHeaders });
  }

  const linearRes = await fetch(targetUrl, {
    headers: { Authorization: LINEAR_API_KEY },
  });

  if (!linearRes.ok || !linearRes.body) {
    return new Response("Failed to fetch image", {
      status: linearRes.status || 502,
      headers: corsHeaders,
    });
  }

  return new Response(linearRes.body, {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": linearRes.headers.get("content-type") ?? "application/octet-stream",
      "Cache-Control": "private, max-age=3600",
    },
  });
});
