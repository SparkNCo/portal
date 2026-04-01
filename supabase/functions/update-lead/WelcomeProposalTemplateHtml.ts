type WelcomeProposalTemplateProps = {
  name: string;
  leadId: string;
  schedulingUrl: string;
  proposalLink: string;
  callTime: string;
};

export function WelcomeProposalTemplateHtml({
  name,
  proposalLink,
  callTime,
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
                  Welcome, ${name} 👋
                </h1>
              </td>
            </tr>

            <!-- Intro -->
            <tr>
              <td style="font-size:14px;line-height:24px;color:#000;padding-bottom:12px;">
                Thanks for reaching out! We’ve received your submission and have
                started preparing a proposal tailored to your project.
              </td>
            </tr>

            <!-- Proposal text -->
            <tr>
              <td style="font-size:14px;line-height:24px;color:#000;padding-bottom:12px;">
                Please visit the below link <span style="font-weight: 600"> prior to our discovery call </span> to enter details about your project idea. 
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
                You'll be receiving a Google Meets invite from Cal.com for our Discovery Call on ${callTime}.   
                After our discovery call, you can use the above link to access the final proposal.



              </td>
            </tr>
           <tr>
              <td style="font-size:14px;line-height:24px;color:#000;">
                See you soon!<br />
                <strong>Kabir Malkani</strong>

              </td>
            </tr>

           <!-- Divider -->
            <tr>
              <td style="padding:26px 0;">
                <hr style="border:none;border-top:1px solid #eaeaea;" />
              </td>
            </tr>

            <tr>
              <td style="font-size:14px;line-height:24px;color:#000;padding-bottom:12px;text-align:center;">
                Spark &amp; Co has you covered for the full software development life cycle. 
                Here's a useful resource to learn more about what that entails.
              </td>
            </tr>

            <tr>
              <td align="center" style="padding:26px 0;">
                <a href="https://www.youtube.com/watch?v=Fi3_BjVzpqk" target="_blank">
                  <img
                    src="https://ozybsusoollnomaaxkcy.supabase.co/storage/v1/object/public/assets/embedThumbnailMail.png"
                    alt="Watch our introduction video"
                    width="100%"
                    style="max-width:420px;border-radius:6px;display:block;"
                  />
                </a>
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
