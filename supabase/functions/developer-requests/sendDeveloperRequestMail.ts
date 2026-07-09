// @ts-nocheck
import { Resend } from "https://esm.sh/resend@3";

const resend = new Resend(Deno.env.get("RESEND_KEY")!);

type SendDeveloperRequestMailParams = {
  email: string;
  role: string;
  allocation?: number;
  notes?: string;
  requestedBy?: string;
  clientName?: string;
};

export async function sendDeveloperRequestMail({
  email,
  role,
  allocation,
  notes,
  requestedBy,
  clientName,
}: SendDeveloperRequestMailParams) {
  console.log("[sendDeveloperRequestMail] 📧 Sending to:", email);

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5;">
      <h2>New Spark & Co FDE developer request 👩‍💻</h2>
      <p>A customer requested a Spark & Co FDE developer be assigned to their team.</p>

      <p><strong>Role needed:</strong> ${role}</p>
      ${allocation ? `<p><strong>Weekly hours:</strong> ${allocation}h/week</p>` : ""}
      ${notes ? `<p><strong>Notes:</strong><br/>${notes}</p>` : ""}
      ${clientName ? `<p><strong>Client:</strong> ${clientName}</p>` : ""}
      ${requestedBy ? `<p><strong>Requested by:</strong> ${requestedBy}</p>` : ""}

      <p style="margin-top:20px; font-size:12px; color:#666;">
        This is an automated message. Assign a developer from the Admin Panel once one has been identified.
      </p>
    </div>
  `;

  const response = await resend.emails.send({
    from: Deno.env.get("FROM_EMAIL"),
    to: email,
    subject: `New Spark & Co FDE developer request${clientName ? ` — ${clientName}` : ""}`,
    html,
  });

  console.log("[sendDeveloperRequestMail] ✅ Response:", response);

  return response;
}
