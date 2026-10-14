// @ts-nocheck
import { supabase } from "../client.ts";
import { sendInviteCustomerMail } from "./sendInviteCustomerMail.ts";
import { assertEmailNotTaken } from "./assertEmailNotTaken.ts";
import type { TestRun } from "../lib/testMode.ts";

// Only `internal` developers carry a rate — `spark_fde` developers are billed
// through the customer's Stripe subscription, unrelated to this record.
const upsertDeveloperRecord = async (
  schema: string,
  userId: string,
  { developerType, rateAmount, rateType }: { developerType: string; rateAmount: number | null; rateType: string | null },
  testRun: TestRun | null,
) => {
  const record = {
    user_id: userId,
    developer_type: developerType,
    rate_amount: developerType === "internal" ? rateAmount : null,
    rate_type: developerType === "internal" ? rateType : null,
  };
  if (testRun) {
    testRun.writes.push({ target: `${schema}.developers`, op: "upsert", data: record });
    return;
  }

  const { error } = await supabase
    .schema(schema)
    .from("developers")
    .upsert(record, { onConflict: "user_id" });

  if (error) {
    console.error("[createUser] developers upsert failed", error.message);
    throw new Error(error.message);
  }
};

// With a TestRun (test mode) every check still runs, but no Auth account,
// row or email is created — they're recorded on the TestRun instead.
export const createUser = async (body: any, schema: string, testRun: TestRun | null = null) => {
  const {
    email,
    role = "developer",
    customer_id = null,
    linear_initiative_id = null,
    project_ids = null,
    initiative_ids = null,
    projects_slug = null,
    auth_id = null,
    firstName = null,
    lastName = null,
    phoneNumber = null,
    userName = null,
    developerType = "spark_fde",
    rateAmount = null,
    rateType = null,
  } = body;

  if (!email) {
    throw new Error("Email is required");
  }

  // Reject up front if this email already belongs to someone — in either the
  // app's own users table or Supabase Auth — instead of silently reusing the
  // existing Auth account and overwriting that person's users row with
  // whatever this form submitted (role, customer_id, name, etc.).
  await assertEmailNotTaken(schema, email);

  // Never trust a client-supplied redirect origin (open-redirect / token-leak
  // risk) — same fix as reset-password/index.ts. This link goes out in an
  // invite email to the *new user's* inbox, so if the admin creating them was
  // on localhost or a preview deployment, the recipient would get a link
  // back to that unusable origin instead of production.
  const redirectTo = "https://app.buildwithspark.co/set-password";

  const { authUserId, inviteLink } = testRun
    ? testInvite(testRun, email, redirectTo)
    : await createInvite(email, redirectTo);

  const userRow = {
    id: authUserId,
    email,
    role,
    customer_id,
    auth_id,
    firstName,
    lastName,
    phoneNumber,
    userName,
  };

  let data;
  if (testRun) {
    testRun.writes.push({ target: `${schema}.users`, op: "upsert", data: userRow });
    data = userRow;
  } else {
    const { data: saved, error: upsertError } = await supabase
      .schema(schema)
      .from("users")
      .upsert([userRow], { onConflict: "id" })
      .select()
      .single();

    if (upsertError) {
      console.error("[createUser] users upsert failed", upsertError.message);
      await supabase.auth.admin.deleteUser(authUserId);
      throw new Error(upsertError.message);
    }
    data = saved;
  }

  if (role === "developer") {
    await upsertDeveloperRecord(schema, authUserId, { developerType, rateAmount, rateType }, testRun);
  }

  console.log("[createUser] user upserted, sending invite email", {
    authUserId,
    email,
  });

  await sendInviteCustomerMail(email, inviteLink, true, testRun);
  console.log("[createUser] invite email sent");

  return data;
};

// Creates the Auth account and its "set your password" link.
async function createInvite(email: string, redirectTo: string) {
  const { data: inviteData, error: inviteError } =
    await supabase.auth.admin.generateLink({
      type: "invite",
      email,
      options: { redirectTo },
    });

  if (inviteError) {
    if (inviteError.message.includes("already been registered")) {
      throw new Error("A user with this email already exists");
    }
    throw new Error(`Auth invite failed: ${inviteError.message}`);
  }

  return {
    authUserId: inviteData.user.id as string,
    inviteLink: inviteData.properties.action_link as string,
  };
}

// Test mode's stand-in for createInvite: a made-up id and a link that goes
// nowhere, so no Auth account is created.
function testInvite(testRun: TestRun, email: string, redirectTo: string) {
  const authUserId = crypto.randomUUID();
  testRun.writes.push({ target: "auth.users", op: "invite", data: { id: authUserId, email } });
  return { authUserId, inviteLink: `${redirectTo}#test-mode` };
}
