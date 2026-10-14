// @ts-nocheck
import { supabase } from "../client.ts";
import { sendInviteCustomerMail } from "./sendInviteCustomerMail.ts";
import { fetchProjectUrlsFromLinear } from "./fetchProjectUrls.ts";
import { assertEmailNotTaken } from "./assertEmailNotTaken.ts";
import { escapeIlike } from "../utils/slug.ts";
import type { TestRun } from "../lib/testMode.ts";
import { createInvite, testInvite } from "./createUser.ts";

// Best-effort: look up the initiative's projects + GitHub repo URLs in Linear
// and fill in linear_projects / project_url so DORA metrics can pick this client up.
// Returns true if usable project data was saved.
// In test mode Linear is still read, but the update is only recorded.
async function fillProjectData(
  clientRecord: any,
  linear_slug: string,
  schema: string,
  testRun: TestRun | null,
): Promise<boolean> {
  try {
    const { linearProjects, projectUrls } = await fetchProjectUrlsFromLinear(linear_slug);
    if (!linearProjects.length && !projectUrls.length) return false;

    if (testRun) {
      testRun.writes.push({
        target: `${schema}.customers`,
        op: "update",
        data: { customer_id: clientRecord.customer_id, linear_projects: linearProjects, project_url: projectUrls },
      });
      clientRecord.linear_projects = linearProjects;
      clientRecord.project_url = projectUrls;
      return linearProjects.length > 0;
    }

    const { error: updateError } = await supabase.schema(schema)
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

// Inserts the `customers` row — or, in test mode, records it with a made-up
// id. Removes the just-created Auth account if the insert fails.
async function insertClient(schema: string, fields: Record<string, unknown>, authUserId: string, testRun: TestRun | null) {
  if (testRun) {
    const record = { customer_id: crypto.randomUUID(), ...fields };
    testRun.writes.push({ target: `${schema}.customers`, op: "insert", data: record });
    return record;
  }

  const { data, error } = await supabase.schema(schema)
    .from("customers")
    .insert([fields])
    .select()
    .single();

  if (error) {
    console.error("[createCustomerFlow] customers insert failed", error.message);
    await supabase.auth.admin.deleteUser(authUserId);
    throw new Error(error.message);
  }
  return data;
}

// Upserts the customer's `users` row — or, in test mode, records it. Undoes
// the Auth account and `customers` row if it fails.
async function upsertCustomerUser(schema: string, row: Record<string, any>, testRun: TestRun | null) {
  if (testRun) {
    testRun.writes.push({ target: `${schema}.users`, op: "upsert", data: row });
    return row;
  }

  const { data, error } = await supabase.schema(schema)
    .from("users")
    .upsert([row], { onConflict: "id" })
    .select()
    .single();

  if (error) {
    console.error("[createCustomerFlow] users upsert failed", error.message);
    await supabase.auth.admin.deleteUser(row.id);
    await supabase.schema(schema).from("customers").delete().eq("customer_id", row.customer_id);
    throw new Error(error.message);
  }
  return data;
}

// With a TestRun (test mode) every check still runs and Linear is still read,
// but no Auth account, row, email or metrics run is created — they're
// recorded on the TestRun instead.
export const createCustomerFlow = async (body: any, schema: string, testRun: TestRun | null = null) => {
  const {
    email,
    customer_id: stripeCustomerId,
    linear_slug,
    firstName = null,
    lastName = null,
    clientName = null,
    phoneNumber = null,
  } = body;

  if (!email) throw new Error("Email required");
  if (!linear_slug) throw new Error("linear_slug required");
  if (!clientName) throw new Error("clientName required");

  // Reject emails already in `users` or Auth — otherwise we'd hijack that
  // person's account and overwrite their users row.
  await assertEmailNotTaken(schema, email);

  // Optional (can be set later in Billing); blank becomes null, never "".
  const normalizedStripeId =
    typeof stripeCustomerId === "string" && stripeCustomerId.trim()
      ? stripeCustomerId.trim()
      : null;

  console.log("[createCustomerFlow] start", { email, linear_slug, clientName, hasStripeId: !!normalizedStripeId });

  // clientName is the URL slug, matched case-insensitively — reject case-only duplicates.
  const { data: existingClient, error: existingClientError } = await supabase.schema(schema)
    .from("customers")
    .select("customer_id")
    .ilike("clientName", escapeIlike(clientName))
    .maybeSingle();

  if (existingClientError) throw new Error(existingClientError.message);
  if (existingClient) throw new Error(`A customer named "${clientName}" already exists`);

  // Never trust a client-supplied redirect origin (open redirect / token leak).
  const redirectTo = `${Deno.env.get("APP_URL") ?? "http://localhost:3000"}/set-password`;
  const { authUserId, inviteLink } = testRun
    ? testInvite(testRun, email, redirectTo)
    : await createInvite(email, redirectTo);
  console.log("[createCustomerFlow] auth user resolved", { authUserId, hasInviteLink: !!inviteLink });

  // Create the client record (linear_slug, clientName, stripe id) in `customers`
  const clientRecord = await insertClient(
    schema,
    { stripe_customer_id: normalizedStripeId, linear_slug, clientName },
    authUserId,
    testRun,
  );
  console.log("[createCustomerFlow] customer record created", { customer_id: clientRecord.customer_id });

  const projectDataReady = await fillProjectData(clientRecord, linear_slug, schema, testRun);

  // Upsert users table, linking to the client record via customer_id
  const customerUser = await upsertCustomerUser(
    schema,
    { id: authUserId, email, role: "customer", customer_id: clientRecord.customer_id, firstName, lastName, phoneNumber, userName: clientName },
    testRun,
  );
  console.log("[createCustomerFlow] user upserted", { authUserId });

  console.log("[createCustomerFlow] sending invite email", {
    email,
    hasResendKey: !!Deno.env.get("RESEND_KEY"),
    fromEmail: Deno.env.get("FROM_EMAIL"),
  });
  await sendInviteCustomerMail(email, inviteLink, true, testRun);
  console.log("[createCustomerFlow] invite email sent");

  if (projectDataReady) {
    if (testRun) testRun.writes.push({ target: "functions/issueMetrics", op: "trigger" });
    else await triggerIssueMetrics();
  }

  return { customer: customerUser, client: clientRecord };
};
