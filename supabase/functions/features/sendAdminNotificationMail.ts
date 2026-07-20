// @ts-nocheck
import { Resend } from "https://esm.sh/resend@3";

const resend = new Resend(Deno.env.get("RESEND_KEY")!);

type SendAdminMailParams = {
  email: string;
  proposalLink: string;
};

function AdminNotificationTemplateHtml({ proposalLink }: { proposalLink: string }) {
  return `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>New proposal ready</title>
  </head>

  <body style="background-color:#ffffff;margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;">
    <!-- Preview text (hidden in body, visible in inbox) -->
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
      A new proposal has been created and is ready for review.
    </div>

    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center" style="padding:40px 8px;">
          <table
            width="100%"
            cellpadding="0"
            cellspacing="0"
            style="
              max-width:465px;
              border:1px solid #eaeaea;
              border-radius:6px;
              padding:20px;
            "
          >
            <tr>
              <td style="padding:26px 0;" align="center">
                <img
                  src="https://ozybsusoollnomaaxkcy.supabase.co/storage/v1/object/public/assets/emailLogo.png"
                  alt="Company Logo"
                  width="80"
                  style="display:block;margin:0 auto;"
                />
              </td>
            </tr>

            <!-- Heading -->
            <tr>
              <td style="text-align:center;padding-bottom:16px;">
                <h1 style="
                  font-size:24px;
                  font-weight:400;
                  margin:0;
                  color:#000;
                ">
                  New proposal ready 🚀
                </h1>
              </td>
            </tr>

            <!-- Intro -->
            <tr>
              <td style="font-size:14px;line-height:24px;color:#000;padding-bottom:12px;text-align:center;">
                A new proposal has been created and is ready for review.
              </td>
            </tr>

            <!-- CTA button -->
            <tr>
              <td align="center" style="padding:24px 0;">
                <a
                  href="${proposalLink}"
                  style="
                    background-color:#000;
                    color:#fff;
                    padding:10px 16px;
                    border-radius:4px;
                    text-decoration:none;
                    font-size:14px;
                    display:inline-block;
                  "
                >
                  View Proposal
                </a>
              </td>
            </tr>

            <!-- Divider -->
            <tr>
              <td style="padding:26px 0;">
                <hr style="border:none;border-top:1px solid #eaeaea;" />
              </td>
            </tr>

            <tr>
              <td style="font-size:12px;line-height:20px;color:#666;text-align:center;">
                This is an automated message.
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

export async function sendAdminNotificationMail({
  email,
  proposalLink,
}: SendAdminMailParams) {
  console.log("[sendAdminNotificationMail] 📧 Sending to:", email);

  const html = AdminNotificationTemplateHtml({ proposalLink });

  const response = await resend.emails.send({
    from: Deno.env.get("FROM_EMAIL"),
    to: email,
    subject: "New proposal ready for review 🚀",
    html,
  });

  console.log("[sendAdminNotificationMail] ✅ Response:", response);

  return response;
}
