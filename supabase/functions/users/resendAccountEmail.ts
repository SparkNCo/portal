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
  const { id, emailType, testRedirectOrigin } = body;

  if (!id) throw new Error("User id is required");

  // The admin picks which copy to send — independent of whether Supabase
  // ends up generating an "invite" or "recovery" link under the hood (both
  // redirect to the same set-password page). Defaults to invite copy since
  // that's also what a brand-new user needs, and lets an admin resend it
  // as many times as needed if the 24h link expired before the user opened it.
  const sendAsInvite = emailType !== "reset";

  const { data: appUser, error: userError } = await supabase.schema(schema)
    .from("users")
    .select("id, email")
    .eq("id", id)
    .maybeSingle();

  if (userError) throw new Error(userError.message);
  if (!appUser) throw new Error("User not found");
  if (!appUser.email) throw new Error("This user has no email on file");

  console.log("[resendAccountEmail] resolving auth user", { id });

  // Never trust a client-supplied origin for the redirect URL (open-redirect /
  // token-leak risk) — always use the server-configured portal origin.
  //
  // TEMPORARY TEST-ONLY OVERRIDE (remove after local invite-link testing):
  // allows the admin panel to request a localhost redirect instead of the
  // prod APP_URL, so a resent invite link can be verified against a local
  // dev server. Restricted to literal localhost/127.0.0.1 origins so it
  // can't be abused as an open redirect even while this is in place.
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
