// @ts-nocheck
import { supabase } from "../client.ts";

// Shared by customer creation and the admin "resend account email" action —
// generates a fresh invite link for a brand-new auth user, or falls back to
// a recovery link when one already exists (Supabase's invite type errors on
// an already-registered email, so this is the resend path for existing users).
export async function resolveAuthUser(
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

  // User already exists in auth — generate a recovery link instead
  const { data: recoveryData, error: recoveryError } = await supabase.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo },
  });
  if (recoveryError) throw new Error(`Link generation failed: ${recoveryError.message}`);

  return { authUserId: recoveryData.user.id, inviteLink: recoveryData.properties.action_link, isNew: false };
}
