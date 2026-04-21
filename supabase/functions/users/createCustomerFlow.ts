// @ts-nocheck
import { supabase } from "../client.ts";
import { sendInviteCustomerMail } from "./sendInviteCustomerMail.ts";

export const createCustomerFlow = async (body: any) => {
  const { email, stripe_customer_id, linear_slug } = body;

  if (!email) throw new Error("Email required");
  if (!linear_slug) throw new Error("linear_slug required");

  // 1. Generate invite link without sending Supabase's default email
  const redirectTo = `http://localhost:3000/set-password?slug=${linear_slug}`;
  const { data: linkData, error: authError } = await supabase.auth.admin.generateLink({
    type: "invite",
    email,
    options: { redirectTo },
  });
  if (authError) throw new Error(`Auth invite failed: ${authError.message}`);

  const authUserId = linkData.user.id;
  const inviteLink = linkData.properties.action_link;

  // 2. Send custom invite email via Resend
  await sendInviteCustomerMail(email, inviteLink);

  // 2. Create CUSTOMER row in users table, linked to the Auth user
  const { data: customerUser, error: customerError } = await supabase
    .from("users")
    .insert([{ id: authUserId, email, role: "customer", stripe_customer_id, linear_slug }])
    .select()
    .single();

  if (customerError) {
    await supabase.auth.admin.deleteUser(authUserId);
    throw new Error(customerError.message);
  }

  return { customer: customerUser };
};
