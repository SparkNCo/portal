// @ts-nocheck
// Shared mail sender. Resend is primary (returns Resend's {data, error} shape);
// falls back to Gmail SMTP when RESEND_KEY isn't set.
import { Resend } from "https://esm.sh/resend@3";
import nodemailer from "npm:nodemailer@6";

export type SendEmailArgs = {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
  // Forces a provider (test-smtp-email uses it to test SMTP while RESEND_KEY is set).
  provider?: "resend" | "smtp";
};

export type SendEmailResult = {
  data: { id: string } | null;
  error: { message: string } | null;
};

// Hardcoded Gmail (App Password); only SMTP_USER/SMTP_PASSWORD come from env.
const SMTP_HOST = "smtp.gmail.com";
const SMTP_PORT = 465;
// Otherwise Gmail shows the account's profile name as the sender.
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
    // Gmail only sends as the account or a verified "Send mail as" alias, so
    // FROM_EMAIL is ignored. Set SMTP_FROM to such an alias to use it.
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
