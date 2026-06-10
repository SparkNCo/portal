// @ts-nocheck
import { supabase } from "../client.ts";
import { sendInviteCustomerMail } from "./sendInviteCustomerMail.ts";

async function resolveAuthUser(
  email: string,
  redirectTo: string,
): Promise<{ authUserId: string; inviteLink: string; isNew: boolean }> {
  const { data: inviteData, error: inviteError } = await supabase.auth.admin.generateLink({
    type: "invite",
    email,
    options: { redirectTo },
  });

  if (!inviteError) {
    return { authUserId: inviteData.user.id, inviteLink: inviteData.properties.action_link, isNew: true };
  }

  if (!inviteError.message.includes("already been registered")) {
    throw new Error(`Auth invite failed: ${inviteError.message}`);
  }

  // User already exists in auth — find them and generate a recovery link instead
  const { data: listData, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) throw new Error(`Could not list auth users: ${listError.message}`);

  const existingAuthUser = listData.users.find((u: any) => u.email === email);
  if (!existingAuthUser) throw new Error("User exists in auth but could not be found");

  const { data: recoveryData, error: recoveryError } = await supabase.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo },
  });
  if (recoveryError) throw new Error(`Link generation failed: ${recoveryError.message}`);

  return { authUserId: existingAuthUser.id, inviteLink: recoveryData.properties.action_link, isNew: false };
}

export const createCustomerFlow = async (body: any) => {
  const {
    email,
    customer_id: stripeCustomerId,
    linear_slug,
    origin,
    firstName = null,
    lastName = null,
    clientName = null,
    phoneNumber = null,
  } = body;

  if (!email) throw new Error("Email required");
  if (!linear_slug) throw new Error("linear_slug required");
  if (!clientName) throw new Error("clientName required");

  const redirectTo = `${origin ?? "http://localhost:3000"}/set-password`;
  const { authUserId, inviteLink, isNew } = await resolveAuthUser(email, redirectTo);

  // Create the client record (linear_slug, clientName, stripe id) in `customers`
  const { data: clientRecord, error: clientError } = await supabase.schema("portal")
    .from("customers")
    .insert([{ stripe_customer_id: stripeCustomerId, linear_slug, clientName }])
    .select()
    .single();

  if (clientError) {
    if (isNew) await supabase.auth.admin.deleteUser(authUserId);
    throw new Error(clientError.message);
  }

  // Upsert users table, linking to the client record via customer_id
  const { data: customerUser, error: upsertError } = await supabase.schema("portal")
    .from("users")
    .upsert(
      [{ id: authUserId, email, role: "customer", customer_id: clientRecord.customer_id, firstName, lastName, phoneNumber }],
      { onConflict: "id" }
    )
    .select()
    .single();

  if (upsertError) {
    if (isNew) await supabase.auth.admin.deleteUser(authUserId);
    await supabase.schema("portal").from("customers").delete().eq("customer_id", clientRecord.customer_id);
    throw new Error(upsertError.message);
  }

  await sendInviteCustomerMail(email, inviteLink);

  return { customer: customerUser, client: clientRecord };
};
