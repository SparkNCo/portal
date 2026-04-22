// @ts-nocheck
import { Resend } from "https://esm.sh/resend@3";

const resend = new Resend(Deno.env.get("RESEND_KEY")!);

function InviteTemplateHtml({ inviteLink }: { inviteLink: string }) {
  return `
  <html>
    <body style="margin:0; padding:0; background-color:#f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5; padding: 40px 0;">
        <tr>
          <td align="center">
            <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff; border-radius:12px; overflow:hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">

              <!-- Header -->
              <tr>
                <td align="center" style="background:#000000; padding: 32px 40px;">
                  <p style="margin:0; font-size:20px; font-weight:700; color:#ffffff; letter-spacing: 0.5px;">SparkCo</p>
                </td>
              </tr>

              <!-- Body -->
              <tr>
                <td align="center" style="padding: 40px 48px 32px;">
                  <h1 style="margin: 0 0 12px; font-size: 24px; font-weight: 700; color: #111111; text-align:center;">You're invited!</h1>
                  <p style="margin: 0 0 28px; font-size: 15px; line-height: 1.6; color: #555555; text-align:center;">
                    You've been invited to access the portal.<br/>Click the button below to set your password and get started.
                  </p>
                  <a
                    href="${inviteLink}"
                    style="display:inline-block; background:#000000; color:#ffffff; font-size:15px; font-weight:600; text-decoration:none; padding:14px 32px; border-radius:8px; letter-spacing:0.3px;"
                  >
                    Set your password
                  </a>
                </td>
              </tr>

              <!-- Divider -->
              <tr>
                <td style="padding: 0 48px;">
                  <hr style="border:none; border-top:1px solid #eeeeee; margin:0;" />
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td align="center" style="padding: 24px 48px 36px;">
                  <p style="margin: 0 0 8px; font-size: 12px; color: #999999; text-align:center;">
                    This link will expire in 24 hours. If you did not expect this invitation, you can safely ignore this email.
                  </p>
                  <p style="margin: 0; font-size: 12px; color: #bbbbbb; text-align:center;">— The SparkCo Team</p>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
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
