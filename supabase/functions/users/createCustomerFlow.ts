// @ts-nocheck
import { supabase } from "../client.ts";
import { sendInviteCustomerMail } from "./sendInviteCustomerMail.ts";
import { fetchProjectUrlsFromLinear } from "./fetchProjectUrls.ts";

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

// Best-effort: look up the initiative's projects + GitHub repo URLs in Linear
// and fill in linear_projects / project_url so DORA metrics can pick this client up.
// Returns true if usable project data was saved.
async function fillProjectData(clientRecord: any, linear_slug: string): Promise<boolean> {
  try {
    const { linearProjects, projectUrls } = await fetchProjectUrlsFromLinear(linear_slug);
    if (!linearProjects.length && !projectUrls.length) return false;

    const { error: updateError } = await supabase.schema("portal")
      .from("customers")
      .update({ linear_projects: linearProjects, project_url: projectUrls })
      .eq("customer_id", clientRecord.customer_id);

    if (updateError) {
      console.error("Failed to save linear_projects/project_url:", updateError.message);
      return false;
    }

    clientRecord.linear_projects = linearProjects;
    clientRecord.project_url = projectUrls;
    return linearProjects.length > 0;
  } catch (err) {
    console.error("Failed to fetch project URLs from Linear:", String(err));
    return false;
  }
}

// Best-effort: kick off issueMetrics now that linear_projects/project_url are set.
// issueMetrics also triggers /dora for every eligible customer once it's done.
async function triggerIssueMetrics() {
  try {
    const issueMetricsUrl = `${Deno.env.get("PROJECT_URL")}/functions/v1/issueMetrics`;
    const res = await fetch(issueMetricsUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${Deno.env.get("SERVICE_SECRET_KEY")}` },
    });
    console.log(`[createCustomerFlow] issueMetrics trigger status=${res.status}`);
  } catch (err) {
    console.error("Failed to trigger issueMetrics:", String(err));
  }
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

  console.log("[createCustomerFlow] start", { email, linear_slug, clientName });

  const redirectTo = `${origin ?? "http://localhost:3000"}/set-password`;
  const { authUserId, inviteLink, isNew } = await resolveAuthUser(email, redirectTo);
  console.log("[createCustomerFlow] auth user resolved", { authUserId, isNew, hasInviteLink: !!inviteLink });

  // Create the client record (linear_slug, clientName, stripe id) in `customers`
  const { data: clientRecord, error: clientError } = await supabase.schema("portal")
    .from("customers")
    .insert([{ stripe_customer_id: stripeCustomerId, linear_slug, clientName }])
    .select()
    .single();

  if (clientError) {
    console.error("[createCustomerFlow] customers insert failed", clientError.message);
    if (isNew) await supabase.auth.admin.deleteUser(authUserId);
    throw new Error(clientError.message);
  }
  console.log("[createCustomerFlow] customer record created", { customer_id: clientRecord.customer_id });

  const projectDataReady = await fillProjectData(clientRecord, linear_slug);

  // Upsert users table, linking to the client record via customer_id
  const { data: customerUser, error: upsertError } = await supabase.schema("portal")
    .from("users")
    .upsert(
      [{ id: authUserId, email, role: "customer", customer_id: clientRecord.customer_id, firstName, lastName, phoneNumber, userName: clientName }],
      { onConflict: "id" }
    )
    .select()
    .single();

  if (upsertError) {
    console.error("[createCustomerFlow] users upsert failed", upsertError.message);
    if (isNew) await supabase.auth.admin.deleteUser(authUserId);
    await supabase.schema("portal").from("customers").delete().eq("customer_id", clientRecord.customer_id);
    throw new Error(upsertError.message);
  }
  console.log("[createCustomerFlow] user upserted", { authUserId });

  console.log("[createCustomerFlow] sending invite email", {
    email,
    hasResendKey: !!Deno.env.get("RESEND_KEY"),
    fromEmail: Deno.env.get("FROM_EMAIL"),
  });
  await sendInviteCustomerMail(email, inviteLink);
  console.log("[createCustomerFlow] invite email sent");

  if (projectDataReady) await triggerIssueMetrics();

  return { customer: customerUser, client: clientRecord };
};
