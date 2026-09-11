// @ts-nocheck
import { Resend } from "https://esm.sh/resend@3";

const resend = new Resend(Deno.env.get("RESEND_KEY")!);

type SendStakeholderAddedMailParams = {
  email: string;
  stakeholderEmail: string;
  stakeholderName?: string;
  clientName?: string;
  addedBy?: string;
};

export async function sendStakeholderAddedMail({
  email,
  stakeholderEmail,
  stakeholderName,
  clientName,
  addedBy,
}: SendStakeholderAddedMailParams) {
  console.log("[sendStakeholderAddedMail] 📧 Sending to:", email);

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5;">
      <h2>New stakeholder added 🧑‍🤝‍🧑</h2>
      <p>A client/stakeholder added a new stakeholder to their initiative from the portal.</p>

      <p><strong>Stakeholder:</strong> ${stakeholderName ? `${stakeholderName} — ` : ""}${stakeholderEmail}</p>
      ${clientName ? `<p><strong>Client:</strong> ${clientName}</p>` : ""}
      ${addedBy ? `<p><strong>Added by:</strong> ${addedBy}</p>` : ""}

      <p style="margin-top:20px; font-size:12px; color:#666;">
        This is an automated message — no action is required, the stakeholder has already been created and assigned.
      </p>
    </div>
  `;

  const response = await resend.emails.send({
    from: Deno.env.get("FROM_EMAIL"),
    to: email,
    subject: `New stakeholder added${clientName ? ` — ${clientName}` : ""}`,
    html,
  });

  console.log("[sendStakeholderAddedMail] ✅ Response:", response);

  return response;
}
