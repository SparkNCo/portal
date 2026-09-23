// @ts-nocheck
// Throwaway manual test for the nodemailer/Gmail SMTP fallback added to
// lib/mailer.ts — sends one real email via `provider: "smtp"`, which
// bypasses Resend even when RESEND_KEY is set, so this actually exercises
// the fallback path instead of silently going through Resend like every
// normal caller does. Hit it directly in a browser or with curl:
//   GET /functions/v1/test-smtp-email
//   GET /functions/v1/test-smtp-email?to=someone@example.com
import { corsHeaders } from "../utils/headers.ts";
import { sendEmail } from "../lib/mailer.ts";

const DEFAULT_TO = "santiagonaguero@gmail.com";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const to = url.searchParams.get("to") || DEFAULT_TO;

    const result = await sendEmail({
      to,
      subject: "SMTP fallback test — SparkCo Portal",
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.5;">
          <h2>It works 📬</h2>
          <p>This email was sent via the nodemailer/Gmail SMTP fallback (lib/mailer.ts), not Resend.</p>
          <p style="margin-top:20px; font-size:12px; color:#666;">Sent at ${new Date().toISOString()}</p>
        </div>
      `,
      provider: "smtp",
    });

    if (result.error) {
      return new Response(JSON.stringify({ success: false, error: result.error }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, to, id: result.data?.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[test-smtp-email]", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
