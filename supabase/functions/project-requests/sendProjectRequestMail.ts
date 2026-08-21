// @ts-nocheck
import { Resend } from "https://esm.sh/resend@3";

const resend = new Resend(Deno.env.get("RESEND_KEY")!);

type SendProjectRequestMailParams = {
  email: string;
  title: string;
  description?: string;
  requestedBy?: string;
  slug?: string;
};

export async function sendProjectRequestMail({
  email,
  title,
  description,
  requestedBy,
  slug,
}: SendProjectRequestMailParams) {
  console.log("[sendProjectRequestMail] 📧 Sending to:", email);

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5;">
      <h2>New Project request 📁</h2>
      <p>A new project has been requested from the client dashboard.</p>

      <p><strong>Title:</strong> ${title}</p>
      ${description ? `<p><strong>Description:</strong><br/>${description}</p>` : ""}
      ${requestedBy ? `<p><strong>Requested by:</strong> ${requestedBy}</p>` : ""}
      ${slug ? `<p><strong>Client:</strong> ${slug}</p>` : ""}

      <p style="margin-top:20px; font-size:12px; color:#666;">
        This is an automated message.
      </p>
    </div>
  `;

  const response = await resend.emails.send({
    from: Deno.env.get("FROM_EMAIL"),
    to: email,
    subject: `New project request: ${title}`,
    html,
  });

  console.log("[sendProjectRequestMail] ✅ Response:", response);

  return response;
}
