// @ts-nocheck
import { Resend } from "https://esm.sh/resend@3";

const resend = new Resend(Deno.env.get("RESEND_KEY")!);

const WelcomeCustomerTemplateHtml = ({ name }: { name: string }) => `
  <html>
    <body style="font-family: sans-serif; color: #333;">
      <h1>Welcome, ${name}!</h1>
      <p>Thanks for joining our platform. We're excited to have you onboard.</p>
      <p>Log in and explore your new account:</p>
      <a href="https://your-app.com/login" style="color: #fff; background: #000; padding: 8px 16px; text-decoration: none; border-radius: 4px;">Go to your account</a>
      <p>Cheers,<br/>The Team</p>
    </body>
  </html>
`;

export async function sendWelcomeCustomerMail(email: string, name: string) {
  console.log("Sending welcome email to:", email);

  const html = WelcomeCustomerTemplateHtml({ name });

  const response = await resend.emails.send({
    from: Deno.env.get("FROM_EMAIL"),
    to: email,
    subject: "Welcome to Our Platform 🚀",
    html,
  });

  console.log("Email sent response:", response);
  return response;
}
