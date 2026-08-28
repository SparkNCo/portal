// @ts-nocheck
import { supabase } from "../client.ts";
import { sendInviteCustomerMail } from "./sendInviteCustomerMail.ts";
import { assertEmailNotTaken } from "./assertEmailNotTaken.ts";

// Only `internal` developers carry a rate — `spark_fde` developers are billed
// through the customer's Stripe subscription, unrelated to this record.
const upsertDeveloperRecord = async (
  schema: string,
  userId: string,
  { developerType, rateAmount, rateType }: { developerType: string; rateAmount: number | null; rateType: string | null },
) => {
  const { error } = await supabase
    .schema(schema)
    .from("developers")
    .upsert(
      {
        user_id: userId,
        developer_type: developerType,
        rate_amount: developerType === "internal" ? rateAmount : null,
        rate_type: developerType === "internal" ? rateType : null,
      },
      { onConflict: "user_id" },
    );

  if (error) {
    console.error("[createUser] developers upsert failed", error.message);
    throw new Error(error.message);
  }
};

export const createUser = async (body: any, schema: string) => {
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

  const authUserId: string = inviteData.user.id;
  const inviteLink: string = inviteData.properties.action_link;

  const { data, error: upsertError } = await supabase
    .schema(schema)
    .from("users")
    .upsert(
      [
        {
          id: authUserId,
          email,
          role,
          customer_id,
          auth_id,
          firstName,
          lastName,
          phoneNumber,
          userName,
        },
      ],
      { onConflict: "id" },
    )
    .select()
    .single();

  if (upsertError) {
    console.error("[createUser] users upsert failed", upsertError.message);
    await supabase.auth.admin.deleteUser(authUserId);
    throw new Error(upsertError.message);
  }

  if (role === "developer") {
    await upsertDeveloperRecord(schema, authUserId, { developerType, rateAmount, rateType });
  }

  console.log("[createUser] user upserted, sending invite email", {
    authUserId,
    email,
  });

  await sendInviteCustomerMail(email, inviteLink);
  console.log("[createUser] invite email sent");

  return data;
};
