// @ts-nocheck
import { supabase } from "../client.ts";

export const createCustomerFlow = async (body: any) => {
  const { email, stripe_customer_id, linear_slug } = body;

  if (!email) throw new Error("Email required");
  if (!linear_slug) throw new Error("linear_slug required");

  // 1. Create user in Supabase Auth and send invite email
  const redirectTo = `http://localhost:3000/set-password?slug=${linear_slug}`;
  const { data: authData, error: authError } =
    await supabase.auth.admin.inviteUserByEmail(email, { redirectTo });
  if (authError) throw new Error(`Auth invite failed: ${authError.message}`);

  const authUserId = authData.user.id;

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
