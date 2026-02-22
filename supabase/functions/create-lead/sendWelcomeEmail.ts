// @ts-nocheck
import { Resend } from "https://esm.sh/resend@3";
import { WelcomeProposalTemplateHtml } from "./WelcomeProposalTemplateHtml.ts";

const resend = new Resend(Deno.env.get("RESEND_KEY")!);

type SendWelcomeMailParams = {
  email: string;
  name: string;
  leadId: string;
  schedulingUrl: string;
  proposalLink: string;
};

export async function sendWelcomeMail({
  email,
  name,
  leadId,
  schedulingUrl,
  proposalLink,
}: SendWelcomeMailParams) {
  console.log("Sending welcome email to:", email, leadId, name);

  const html = WelcomeProposalTemplateHtml({
    name,
    leadId,
    schedulingUrl,
    proposalLink,
  });

  const response = await resend.emails.send({
    from: Deno.env.get("FROM_EMAIL"),
    to: email,
    subject: "Your project proposal is ready 🚀",
    html,
  });

  return response;
}
