// @ts-nocheck
import { Resend } from "https://esm.sh/resend@3";

const resend = new Resend(Deno.env.get("RESEND_KEY")!);

type SendAdminMailParams = {
  email: string;
  proposalLink: string;
};

export async function sendAdminNotificationMail({
  email,
  proposalLink,
}: SendAdminMailParams) {
  console.log("[sendAdminNotificationMail] 📧 Sending to:", email);

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5;">
      <h2>New proposal ready 🚀</h2>
      <p>A new proposal has been created and is ready for review.</p>
      
      <p>
        👉 <a href="${proposalLink}" target="_blank">
          View Proposal
        </a>
      </p>

      <p style="margin-top:20px; font-size:12px; color:#666;">
        This is an automated message.
      </p>
    </div>
  `;

  const response = await resend.emails.send({
    from: Deno.env.get("FROM_EMAIL"),
    to: email,
    subject: "New proposal ready for review 🚀",
    html,
  });

  console.log("[sendAdminNotificationMail] ✅ Response:", response);

  return response;
}
