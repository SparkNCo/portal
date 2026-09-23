// @ts-nocheck
// Shared outbound-mail sender for every edge function that used to construct
// its own `new Resend(...)` client directly. Resend stays the primary
// provider (same behavior as before, same {data, error} response shape so
// every existing `if (response.error) throw ...` call site keeps working
// unchanged) — this only adds a fallback for when RESEND_KEY isn't set (a
// revoked/rotated key, or an environment that was never given one), so
// outbound mail degrades to plain SMTP instead of silently failing.
import { Resend } from "https://esm.sh/resend@3";
import nodemailer from "npm:nodemailer@6";

export type SendEmailArgs = {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
  // Forces a specific provider, bypassing the normal "Resend if RESEND_KEY
  // is set, else SMTP" choice — the test-smtp-email function uses this to
  // actually exercise the nodemailer path even when RESEND_KEY is set,
  // instead of silently going through Resend like every normal caller does.
  provider?: "resend" | "smtp";
};

export type SendEmailResult = {
  data: { id: string } | null;
  error: { message: string } | null;
};

// Gmail SMTP — fixed rather than read from env, since this fallback is
// specifically Gmail (with an App Password) and not a swappable provider.
// Only the account itself (SMTP_USER/SMTP_PASSWORD, Supabase secrets) varies.
const SMTP_HOST = "smtp.gmail.com";
const SMTP_PORT = 465;
// Without an explicit display name, Gmail fills the From header with the
// account's own profile name (e.g. "santiaagu2024") instead of something a
// recipient would recognize.
const SMTP_FROM_NAME = "SparkCo Support";

let smtpTransporter: ReturnType<typeof nodemailer.createTransport> | null = null;

function getSmtpTransporter() {
  if (smtpTransporter) return smtpTransporter;

  const user = Deno.env.get("SMTP_USER");
  const pass = Deno.env.get("SMTP_PASSWORD");

  if (!user || !pass) {
    throw new Error(
      "No RESEND_KEY set, and SMTP fallback isn't configured — need SMTP_USER, SMTP_PASSWORD (a Gmail App Password)",
    );
  }

  smtpTransporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: true,
    auth: { user, pass },
  });
  return smtpTransporter;
}

async function sendViaSmtp(args: SendEmailArgs): Promise<SendEmailResult> {
  try {
    const transporter = getSmtpTransporter();
    // Gmail only ever sends as the authenticated account (or a verified
    // "Send As" alias of it — Gmail Settings → Accounts → "Send mail as")
    // — an arbitrary FROM_EMAIL (the app's usual "from", meant for Resend)
    // gets silently rewritten or rejected, so this ignores it. SMTP_FROM is
    // optional: set it to a verified alias to send as that address instead
    // of the raw SMTP_USER account.
    const fromAddress = Deno.env.get("SMTP_FROM") || Deno.env.get("SMTP_USER")!;
    const from = `${SMTP_FROM_NAME} <${fromAddress}>`;
    const info = await transporter.sendMail({ from, to: args.to, subject: args.subject, html: args.html });
    return { data: { id: info.messageId }, error: null };
  } catch (err) {
    console.error("[sendEmail] SMTP fallback failed:", err);
    return { data: null, error: { message: err.message ?? "SMTP send failed" } };
  }
}

export async function sendEmail(args: SendEmailArgs): Promise<SendEmailResult> {
  const from = args.from ?? Deno.env.get("FROM_EMAIL")!;
  const resendKey = Deno.env.get("RESEND_KEY");
  const useResend = args.provider ? args.provider === "resend" : !!resendKey;

  if (useResend) {
    if (!resendKey) throw new Error("provider: 'resend' requested but RESEND_KEY isn't set");
    const resend = new Resend(resendKey);
    return await resend.emails.send({ from, to: args.to, subject: args.subject, html: args.html });
  }

  if (!args.provider) {
    console.warn("[sendEmail] RESEND_KEY not set — falling back to SMTP via nodemailer");
  }
  return await sendViaSmtp(args);
}
