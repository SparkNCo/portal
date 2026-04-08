// @ts-nocheck
import { supabase } from "../client.ts";
import { Resend } from "https://esm.sh/resend@3";

const resend = new Resend(Deno.env.get("RESEND_KEY")!);

export const createUser = async (body: any) => {
  const {
    email,
    role = "user",
    customer_id = null,
    subscription_id = null,
    linear_initiative_id = null,
    project_ids = null,
    initiative_ids = null,
    projects_slug = null,
    auth_id = null,
  } = body;

  if (!email) {
    throw new Error("Email is required");
  }

  const { data, error } = await supabase
    .from("users")
    .insert([
      {
        email,
        role,
        customer_id,
        subscription_id,
        linear_initiative_id,
        project_ids,
        initiative_ids,
        projects_slug,
        auth_id,
      },
    ])
    .select()
    .single();

  if (error) throw new Error(error.message);

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5;">
      <h2>Welcome to Spark & Co 🚀</h2>
      <p>Your account has been created successfully.</p>
      <p>You can now log in and access your portal:</p>
      <p>
        👉 <a href="https://app.buildwithspark.co" target="_blank">
          Go to Spark & Co
        </a>
      </p>
      <p style="margin-top:20px; font-size:12px; color:#666;">
        This is an automated message.
      </p>
    </div>
  `;

  await resend.emails.send({
    from: Deno.env.get("FROM_EMAIL"),
    to: email,
    subject: "Your Spark & Co account is ready 🚀",
    html,
  });

  return data;
};
