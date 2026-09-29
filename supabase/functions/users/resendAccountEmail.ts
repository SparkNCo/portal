// @ts-nocheck
import { supabase } from "../client.ts";
import { resolveAuthUser } from "./resolveAuthUser.ts";
import { sendInviteCustomerMail } from "./sendInviteCustomerMail.ts";

// Admin action: resend the setup/validation email for an existing user.
// Read-only on customers/users, so it can't create duplicate records.
export const resendAccountEmail = async (body: any, schema: string) => {
  const { id, emailType, testRedirectOrigin } = body;

  if (!id) throw new Error("User id is required");

  // Email copy only — both link types land on set-password. Defaults to invite
  // (e.g. resending after the 24h link expired).
  const sendAsInvite = emailType !== "reset";

  const { data: appUser, error: userError } = await supabase.schema(schema)
    .from("users")
    .select("id, email")
    .eq("id", id)
    .maybeSingle();

  if (userError) throw new Error(userError.message);
  if (!appUser) throw new Error("User not found");
  if (!appUser.email) throw new Error("This user has no email on file");

  // users.id = Auth user id. last_sign_in_at is set when the invite link is
  // opened, so non-null means already accepted. Only blocks invites, not resets.
  if (sendAsInvite) {
    const { data: authUser, error: authLookupError } =
      await supabase.auth.admin.getUserById(id);
    if (authLookupError) throw new Error(authLookupError.message);
    if (authUser?.user?.last_sign_in_at) {
      throw new Error(
        "This user has already accepted their invite. Use “Send password reset” instead.",
      );
    }
  }

  console.log("[resendAccountEmail] resolving auth user", { id });

  // Never trust a client-supplied redirect origin (open redirect / token leak).
  //
  // TEMPORARY TEST-ONLY OVERRIDE — remove after local invite-link testing:
  // allows a localhost/127.0.0.1 redirect (only those) for testing against a dev server.
  const isLocalTestOrigin =
    typeof testRedirectOrigin === "string" &&
    /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(testRedirectOrigin);

  const redirectOrigin = isLocalTestOrigin
    ? testRedirectOrigin
    : Deno.env.get("APP_URL") ?? "http://localhost:3000";
  const redirectTo = `${redirectOrigin}/set-password`;

  let inviteLink: string;
  try {
    const authResult = await resolveAuthUser(appUser.email, redirectTo);
    inviteLink = authResult.inviteLink;
  } catch (err) {
    console.error("[resendAccountEmail] auth resolution failed", err.message);
    throw new Error(`Could not resolve this user's auth account: ${err.message}`);
  }

  await sendInviteCustomerMail(appUser.email, inviteLink, sendAsInvite);
  console.log("[resendAccountEmail] email resent", { id, sendAsInvite, sent: true });

  return { sent: true, email: appUser.email };
};
