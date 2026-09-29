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

    // Never trust a client-supplied redirect origin (open redirect / token leak).
    const redirectTo = "https://app.buildwithspark.co/reset-password";

    // Generate the link via the admin API and send it ourselves: Supabase's
    // built-in mailer has a very low rate limit.
    //
    // NOT resolveAuthUser: it falls back to an "invite", which would create an
    // orphan auth user for any email typed into this public form. "recovery"
    // errors on unknown emails, so those are a no-op.
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
      // Always respond success so emails can't be enumerated.
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
