export const WelcomeCustomerTemplateHtml = ({ name }: { name: string }) => `
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