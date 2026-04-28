// @ts-nocheck
import { supabase } from "../client.ts";
import { sendInviteCustomerMail } from "./sendInviteCustomerMail.ts";

export const createCustomerFlow = async (body: any) => {
  const { email, customer_id, linear_slug } = body;

  if (!email) throw new Error("Email required");
  if (!linear_slug) throw new Error("linear_slug required");

  const redirectTo = "http://localhost:3000/set-password";

  let authUserId: string;
  let inviteLink: string;

  const { data: inviteData, error: inviteError } = await supabase.auth.admin.generateLink({
    type: "invite",
    email,
    options: { redirectTo },
  });

  if (inviteError) {
    if (!inviteError.message.includes("already been registered")) {
      throw new Error(`Auth invite failed: ${inviteError.message}`);
    }

    // User already exists in auth — find them and generate a recovery link instead
    const { data: listData, error: listError } = await supabase.auth.admin.listUsers();
    if (listError) throw new Error(`Could not list auth users: ${listError.message}`);

    const existingAuthUser = listData.users.find((u: any) => u.email === email);
    if (!existingAuthUser) throw new Error("User exists in auth but could not be found");

    authUserId = existingAuthUser.id;

    const { data: recoveryData, error: recoveryError } = await supabase.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo },
    });
    if (recoveryError) throw new Error(`Link generation failed: ${recoveryError.message}`);

    inviteLink = recoveryData.properties.action_link;
  } else {
    authUserId = inviteData.user.id;
    inviteLink = inviteData.properties.action_link;
  }

  // Upsert users table — insert on new, update columns on existing
  const { data: customerUser, error: upsertError } = await supabase
    .from("users")
    .upsert(
      [{ id: authUserId, email, role: "customer", customer_id, linear_slug }],
      { onConflict: "id" }
    )
    .select()
    .single();

  if (upsertError) {
    // Only clean up the auth user if we just created them (invite path)
    if (!inviteError) await supabase.auth.admin.deleteUser(authUserId);
    throw new Error(upsertError.message);
  }

  await sendInviteCustomerMail(email, inviteLink);

  return { customer: customerUser };
};
