type SubscriptionEmailTemplateProps = {
  name: string;
  paymentLink: string;
};

export function SubscriptionEmailTemplateHtml({
  name,
  paymentLink,
}: SubscriptionEmailTemplateProps) {
  return `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>Complete your subscription</title>
  </head>

  <body style="background-color:#ffffff;margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;">
    <!-- Preview text -->
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
      Complete your Spark Portal subscription to get started.
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
            <!-- Heading -->
            <tr>
              <td style="text-align:center;padding-bottom:16px;">
                <h1 style="
                  font-size:24px;
                  font-weight:400;
                  margin:0;
                  color:#000;
                ">
                  Welcome${name ? `, ${name}` : ""} 👋
                </h1>
              </td>
            </tr>

            <!-- Intro -->
            <tr>
              <td style="font-size:14px;line-height:24px;color:#000;padding-bottom:12px;">
                You’re almost there! To activate your Spark Portal account,
                please complete your subscription.
              </td>
            </tr>

            <!-- Instructions -->
            <tr>
              <td style="font-size:14px;line-height:24px;color:#000;padding-bottom:12px;">
                Click the button below to securely enter your payment details
                and finish setting up your subscription.
              </td>
            </tr>

            <!-- CTA Button -->
            <tr>
              <td align="center" style="padding:24px 0;">
                <a
                  href="${paymentLink}"
                  target="_blank"
                  style="
                    background-color:#000;
                    color:#fff;
                    padding:12px 18px;
                    border-radius:4px;
                    text-decoration:none;
                    font-size:14px;
                    display:inline-block;
                  "
                >
                  Complete subscription
                </a>
              </td>
            </tr>

            <!-- Info -->
            <tr>
              <td style="font-size:13px;line-height:22px;color:#000;padding-bottom:20px;">
                Once your payment is completed, your account will be activated
                automatically. You’ll be able to manage your payment method and
                view invoices anytime from your billing page.
              </td>
            </tr>

            <!-- Divider -->
            <tr>
              <td style="padding:26px 0;">
                <hr style="border:none;border-top:1px solid #eaeaea;" />
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="font-size:14px;line-height:24px;color:#000;">
                If you have any questions, just reply to this email — we’re happy
                to help.
                <br /><br />
                Have a great day,<br />
                <strong>The Spark Portal Team</strong>
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
