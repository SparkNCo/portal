// @ts-nocheck
import { supabase } from "../client.ts";

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

  const redirectTo = "https://app.buildwithspark.co";

  let authUserId: string;

  const { data: inviteData, error: inviteError } = await supabase.auth.admin.generateLink({
    type: "invite",
    email,
    options: { redirectTo },
  });

  if (inviteError) {
    if (!inviteError.message.includes("already been registered")) {
      throw new Error(`Auth invite failed: ${inviteError.message}`);
    }

    const { data: listData, error: listError } = await supabase.auth.admin.listUsers();
    if (listError) throw new Error(`Could not list auth users: ${listError.message}`);

    const existingAuthUser = listData.users.find((u: any) => u.email === email);
    if (!existingAuthUser) throw new Error("User exists in auth but could not be found");

    authUserId = existingAuthUser.id;
  } else {
    authUserId = inviteData.user.id;
  }

  const { data, error: upsertError } = await supabase
    .from("users")
    .upsert(
      [{
        id: authUserId,
        email,
        role,
        customer_id,
        subscription_id,
        linear_initiative_id,
        project_ids,
        initiative_ids,
        projects_slug,
        auth_id,
      }],
      { onConflict: "id" },
    )
    .select()
    .single();

  if (upsertError) {
    if (!inviteError) await supabase.auth.admin.deleteUser(authUserId);
    throw new Error(upsertError.message);
  }

  return data;
};
