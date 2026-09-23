// @ts-nocheck
import { sendEmail } from "../lib/mailer.ts";
import { WelcomeProposalTemplateHtml } from "./WelcomeProposalTemplateHtml.ts";

type SendWelcomeMailParams = {
  email: string;
  name: string;
  leadId: string;
  schedulingUrl: string;
  proposalLink: string;
  callTime: string;
};

export async function sendWelcomeMail({
  email,
  name,
  leadId,
  schedulingUrl,
  proposalLink,
  callTime,
}: SendWelcomeMailParams) {
  console.log("Sending welcome email to:", email, leadId, name);
  console.log("callTime in sendWelcomeMail:", callTime);

  const html = WelcomeProposalTemplateHtml({
    name,
    leadId,
    schedulingUrl,
    proposalLink,
    callTime,
  });

  const response = await sendEmail({
    to: email,
    subject: "Your project proposal is ready 🚀",
    html,
  });
  console.log("response from resend:", response);

  return response;
}
