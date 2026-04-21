// @ts-nocheck
import { Resend } from "https://esm.sh/resend@3";

const resend = new Resend(Deno.env.get("RESEND_KEY")!);

function InviteTemplateHtml({ inviteLink }: { inviteLink: string }) {
  return `
  <html>
    <body style="font-family: sans-serif; color: #333; max-width: 480px; margin: auto; padding: 24px;">
      <h1 style="font-size: 22px;">You've been invited</h1>
      <p>You have been invited to access the portal. Click the button below to set your password and get started.</p>
      <a
        href="${inviteLink}"
        style="display:inline-block; color:#fff; background:#000; padding:10px 20px; text-decoration:none; border-radius:6px; font-weight:600; margin: 16px 0;"
      >
        Set your password
      </a>
      <p style="font-size: 12px; color: #888;">This link will expire in 24 hours. If you did not expect this invitation, you can ignore this email.</p>
      <p>Cheers,<br/>The Team</p>
    </body>
  </html>
  `;
}

export async function sendInviteCustomerMail(email: string, inviteLink: string) {
  const response = await resend.emails.send({
    from: Deno.env.get("FROM_EMAIL"),
    to: email,
    subject: "You've been invited to the portal",
    html: InviteTemplateHtml({ inviteLink }),
  });

  console.log("[sendInviteCustomerMail] response:", response);
  return response;
}
