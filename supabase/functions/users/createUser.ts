// @ts-nocheck
import { supabase } from "../client.ts";
import { sendInviteCustomerMail } from "./sendInviteCustomerMail.ts";

export const createUser = async (body: any) => {
  const {
    email,
    role = "developer",
    customer_id = null,
    linear_initiative_id = null,
    project_ids = null,
    initiative_ids = null,
    projects_slug = null,
    auth_id = null,
    origin,
    firstName = null,
    lastName = null,
    phoneNumber = null,
    userName = null,
  } = body;

  if (!email) {
    throw new Error("Email is required");
  }

  const redirectTo = `${origin ?? "https://app.buildwithspark.co"}/set-password`;

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

  const { data, error: upsertError } = await supabase.schema("portal")
    .from("users")
    .upsert(
      [{
        id: authUserId,
        email,
        role,
        customer_id,
        auth_id,
        firstName,
        lastName,
        phoneNumber,
        userName,
      }],
      { onConflict: "id" },
    )
    .select()
    .single();

  if (upsertError) {
    console.error("[createUser] users upsert failed", upsertError.message);
    if (!inviteError) await supabase.auth.admin.deleteUser(authUserId);
    throw new Error(upsertError.message);
  }
  console.log("[createUser] user upserted, sending invite email", { authUserId, email });

  await sendInviteCustomerMail(email, inviteLink);
  console.log("[createUser] invite email sent");

  return data;
};
