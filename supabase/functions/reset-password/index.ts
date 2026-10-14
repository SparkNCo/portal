// @ts-nocheck
import { supabase } from "../client.ts";
import { corsHeaders } from "../utils/headers.ts";
import { sendInviteCustomerMail } from "../users/sendInviteCustomerMail.ts";
import { resolveTestMode, testModeBody, TestModeRejected, type TestRun } from "../lib/testMode.ts";

// Paged: listUsers can't look an email up directly.
async function authUserExists(email: string): Promise<boolean> {
  const perPage = 1000;
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(error.message);
    if (data.users.some((u) => u.email?.toLowerCase() === email.toLowerCase())) return true;
    if (data.users.length < perPage) return false;
  }
}

// The reset link. In test mode no recovery token is issued (that writes to
// the Auth account): it only checks the account exists — which is what makes
// the real link fail for unknown emails — and stands in a link that goes
// nowhere, recording what it skipped.
async function recoveryLink(email: string, redirectTo: string, testRun: TestRun | null): Promise<string> {
  if (testRun) {
    if (!(await authUserExists(email))) throw new Error("User not found");
    testRun.writes.push({ target: "auth.users", op: "recovery", data: { email } });
    return `${redirectTo}#test-mode`;
  }

  const { data, error } = await supabase.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo },
  });
  if (error) throw new Error(error.message);
  return data.properties.action_link;
}

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

    // Test mode (lib/testMode.ts): no recovery token issued, no email sent.
    const testRun = resolveTestMode(req);

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
      const link = await recoveryLink(email, redirectTo, testRun);
      await sendInviteCustomerMail(email, link, false, testRun);
      console.log("[reset-password] Password reset email sent to:", email);
    } catch (err) {
      // Always respond success so emails can't be enumerated.
      console.error("[reset-password] Failed to resolve/send for", email, err.message);
    }

    const result = { success: true };
    return new Response(JSON.stringify(testRun ? testModeBody(testRun, result) : result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    if (error instanceof TestModeRejected) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.error("[reset-password] Error:", error);

    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
