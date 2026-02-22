type WelcomeProposalTemplateProps = {
  name: string;
  leadId: string;
  schedulingUrl: string;
  proposalLink: string;
};

export function WelcomeProposalTemplateHtml({
  name,
  schedulingUrl,
  proposalLink,
}: WelcomeProposalTemplateProps) {
  return `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>Your proposal is ready</title>
  </head>

  <body style="background-color:#ffffff;margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;">
    <!-- Preview text (hidden in body, visible in inbox) -->
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
      Your proposal is ready — confirm your meeting to continue.
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
                  Welcome, ${name} 👋
                </h1>
              </td>
            </tr>

            <!-- Intro -->
            <tr>
              <td style="font-size:14px;line-height:24px;color:#000;padding-bottom:12px;">
                Thanks for reaching out! We’ve received your submission and
                started preparing a proposal tailored to your project.
              </td>
            </tr>

            <!-- Proposal text -->
            <tr>
              <td style="font-size:14px;line-height:24px;color:#000;padding-bottom:12px;">
                You can access and complete your proposal using the link below:
              </td>
            </tr>

            <!-- Proposal button -->
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
                  View your proposal
                </a>
              </td>
            </tr>

            <tr>
              <td style="font-size:14px;line-height:24px;color:#000;padding-bottom:20px;">
                Please add the required details about the features you’d like.
                Once completed, you’ll be able to review the finalized proposal at
                the same link.
              </td>
            </tr>

            <!-- Divider -->
            <tr>
              <td style="padding:26px 0;">
                <hr style="border:none;border-top:1px solid #eaeaea;" />
              </td>
            </tr>

            <!-- Scheduling -->
            <tr>
              <td style="font-size:14px;line-height:24px;color:#000;font-weight:500;">
                📅 Confirm your meeting
              </td>
            </tr>

            <tr>
              <td style="font-size:14px;line-height:24px;color:#000;padding-top:8px;">
                To move forward, please confirm your meeting by selecting your
                preferred time using the link below. This step is required to
                finalize your booking.
              </td>
            </tr>

            <!-- Scheduling button -->
            <tr>
              <td align="center" style="padding:24px 0;">
                <a
                  href="${schedulingUrl}"
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
                  Confirm meeting time
                </a>
              </td>
            </tr>

            <tr>
              <td style="font-size:13px;line-height:22px;color:#6b7280;">
                Once the meeting is confirmed, you’ll receive a calendar invite
                with all the details.
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
                Have a great day,<br />
                <strong>The Team</strong>
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
