// @ts-nocheck
import { supabase } from "../client.ts";
import { sendWelcomeCustomerMail } from "./sendWelcomeCustomerMail.ts";

export const createCustomerFlow = async (body: any) => {
  const { email, stripe_customer_id, linear_initiative_id } = body;

  if (!email) throw new Error("Email required");

  // 1. Create ADMIN user
  const { data: adminUser, error: adminError } = await supabase
    .from("users")
    .insert([{ email, role: "admin" }])
    .select()
    .single();
  if (adminError) throw new Error(adminError.message);

  // 2. Create CUSTOMER user
  const { data: customerUser, error: customerError } = await supabase
    .from("users")
    .insert([
      {
        email,
        role: "customer",
        stripe_customer_id,
        linear_initiative_id,
        linear_name: email,
        linear_slug: email?.split("@")[0],
      },
    ])
    .select()
    .single();

  if (customerError) {
    await supabase.from("users").delete().eq("id", adminUser.id);
    throw new Error(customerError.message);
  }

  // 3. Create assignment
  const { error: assignError } = await supabase.from("assignments").insert([
    {
      user_id: adminUser.id,
      customer_id: customerUser.id,
    },
  ]);
  if (assignError) {
    await supabase.from("users").delete().eq("id", adminUser.id);
    await supabase.from("users").delete().eq("id", customerUser.id);
    throw new Error(assignError.message);
  }

  // 4. Send welcome email
  try {
    await sendWelcomeCustomerMail(email, email?.split("@")[0]);
  } catch (err) {
    console.error("Failed to send welcome email:", err);
    // Don't rollback user creation if email fails
  }

  return { admin: adminUser, customer: customerUser };
};
