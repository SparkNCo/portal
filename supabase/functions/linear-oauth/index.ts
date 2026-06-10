// @ts-nocheck
import { supabase } from "../client.ts";
import { corsHeaders } from "../utils/headers.ts";

const LINEAR_TOKEN_URL = "https://api.linear.app/oauth/token";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const userId = url.searchParams.get("state");
  const appUrl = Deno.env.get("APP_URL") ?? "http://localhost:3000";

  if (!code || !userId) {
    return new Response("Missing code or state", { status: 400 });
  }

  try {
    // Exchange code for access token
    const tokenRes = await fetch(LINEAR_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: Deno.env.get("LINEAR_CLIENT_ID")!,
        client_secret: Deno.env.get("LINEAR_CLIENT_SECRET")!,
        redirect_uri: Deno.env.get("LINEAR_REDIRECT_URI")!,
        code,
        grant_type: "authorization_code",
      }),
    });

    const tokenData = await tokenRes.json();

    if (!tokenData.access_token) {
      console.error("Token exchange failed:", tokenData);
      return Response.redirect(`${appUrl}?linear_error=token_exchange_failed`);
    }

    // Store token on the user row
    const { error } = await supabase.schema("portal")
      .from("users")
      .update({ linear_access_token: tokenData.access_token })
      .eq("id", userId);

    if (error) {
      console.error("Failed to store token:", error);
      return Response.redirect(`${appUrl}?linear_error=store_failed`);
    }

    return Response.redirect(`${appUrl}?linear_connected=true`);
  } catch (err) {
    console.error("[linear-oauth error]", err);
    return Response.redirect(`${appUrl}?linear_error=unexpected`);
  }
});
