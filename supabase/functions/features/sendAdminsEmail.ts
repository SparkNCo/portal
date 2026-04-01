// @ts-nocheck

import { supabase } from "../client.ts";
import { sendAdminNotificationMail } from "./sendAdminNotificationMail.ts";

export async function sendAdminsEmail(passcode: string) {
  console.log("[sendAdminsEmail] 🚀 Triggered with passcode:", passcode);

  const redirectUrl = "https://buildwithspark.co";
  const proposalLink = `${redirectUrl}/proposal?mode=features&passcode=${passcode}`;

  // Fetch all admins
  const { data: admins, error } = await supabase
    .from("users")
    .select("email, role")
    .eq("role", "admin"); // Removed the email filter

  if (error) {
    console.error("[sendAdminsEmail] ❌ Error fetching admins:", error);
    return;
  }

  if (!admins || admins.length === 0) {
    console.warn("[sendAdminsEmail] ⚠️ No admins found");
    return;
  }

  console.log("[sendAdminsEmail] 👥 Admins found:", admins.length);

  for (const admin of admins) {
    try {
      await sendAdminNotificationMail({
        email: admin.email,
        proposalLink,
      });
    } catch (err) {
      console.error(
        "[sendAdminsEmail] ❌ Failed sending email to:",
        admin.email,
        err,
      );
    }
  }
}
