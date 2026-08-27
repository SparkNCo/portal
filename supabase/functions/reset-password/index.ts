// @ts-nocheck
import { supabase } from "../client.ts";
import { corsHeaders } from "../utils/headers.ts";
import { sendInviteCustomerMail } from "../users/sendInviteCustomerMail.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { email } = body;

    if (!email) {
      return new Response(JSON.stringify({ error: "email is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Never trust a client-supplied redirect origin (open-redirect / token-leak
    // risk) — always use the production portal origin. The frontend never
    // actually sent one anyway, which meant this always fell back to a
    // hardcoded localhost URL, even in production.
    const redirectTo = "https://app.buildwithspark.co/reset-password";

    // supabase.auth.resetPasswordForEmail() has Supabase send the email
    // itself through its built-in mailer, which has a very low default rate
    // limit ("email rate limit exceeded") — the admin "resend" flow
    // (resendAccountEmail.ts) never hits this because it only uses the admin
    // API to generate the link, then sends it itself via Resend. Same
    // approach here.
    //
    // Deliberately NOT resolveAuthUser (used by the admin resend flow) — that
    // helper falls back to an "invite" link when the email isn't already
    // registered, which actually CREATES a brand-new orphaned auth user for
    // any email typed into this public, unauthenticated form. "recovery"
    // requires an existing user and errors out instead, so an unknown email
    // is a no-op here, matching resetPasswordForEmail()'s original behavior.
    try {
      const { data, error } = await supabase.auth.admin.generateLink({
        type: "recovery",
        email,
        options: { redirectTo },
      });
      if (error) throw new Error(error.message);
      await sendInviteCustomerMail(email, data.properties.action_link, false);
      console.log("[reset-password] Password reset email sent to:", email);
    } catch (err) {
      // Never reveal whether the email exists — same anti-enumeration
      // behavior resetPasswordForEmail() had (always responds success).
      console.error("[reset-password] Failed to resolve/send for", email, err.message);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[reset-password] Error:", error);

    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
