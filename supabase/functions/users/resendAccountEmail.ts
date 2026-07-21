// @ts-nocheck
import { supabase } from "../client.ts";
import { resolveAuthUser } from "./resolveAuthUser.ts";
import { sendInviteCustomerMail } from "./sendInviteCustomerMail.ts";

// Admin action: resend the password-setup / account-validation email for an
// EXISTING user, without touching `customers`/`users` at all — this only
// reads the user's email and re-triggers the Supabase Auth email flow, so it
// can never create a duplicate customer record (unlike the old workaround of
// re-running customer creation with the same email).
export const resendAccountEmail = async (body: any, schema: string) => {
  const { id, origin } = body;

  if (!id) throw new Error("User id is required");

  const { data: appUser, error: userError } = await supabase.schema(schema)
    .from("users")
    .select("id, email")
    .eq("id", id)
    .maybeSingle();

  if (userError) throw new Error(userError.message);
  if (!appUser) throw new Error("User not found");
  if (!appUser.email) throw new Error("This user has no email on file");

  console.log("[resendAccountEmail] resolving auth user", { id, email: appUser.email });

  const redirectTo = `${origin ?? "http://localhost:3000"}/set-password`;

  let inviteLink: string;
  try {
    const authResult = await resolveAuthUser(appUser.email, redirectTo);
    inviteLink = authResult.inviteLink;
  } catch (err) {
    console.error("[resendAccountEmail] auth resolution failed", err.message);
    throw new Error(`Could not resolve this user's auth account: ${err.message}`);
  }

  await sendInviteCustomerMail(appUser.email, inviteLink);
  console.log("[resendAccountEmail] email resent", { id, email: appUser.email });

  return { sent: true, email: appUser.email };
};
