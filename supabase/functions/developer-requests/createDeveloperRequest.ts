// @ts-nocheck
import { supabase } from "../client.ts";
import { sendDeveloperRequestMail } from "./sendDeveloperRequestMail.ts";

// POST /developer-requests — customer requests a Spark & Co FDE developer be
// assigned to their team. No user/assignment is created here; admins get
// emailed and assign someone manually from the Admin Panel.
export async function createDeveloperRequest(req: Request): Promise<Response> {
  const { role, allocation, notes, requestedBy, clientName } = await req.json();

  if (!role) {
    return Response.json({ error: "Missing role" }, { status: 400 });
  }

  const { data: admins, error } = await supabase
    .schema("portal")
    .from("users")
    .select("email, role")
    .eq("role", "admin");

  if (error) {
    console.error("[createDeveloperRequest] ❌ Error fetching admins:", error);
    return Response.json(
      { error: "Failed to look up admins", details: error.message },
      { status: 500 },
    );
  }

  if (!admins || admins.length === 0) {
    console.warn("[createDeveloperRequest] ⚠️ No matching admin found");
    return Response.json({ error: "No admin recipient found" }, { status: 404 });
  }

  for (const admin of admins) {
    await sendDeveloperRequestMail({
      email: admin.email,
      role: String(role).trim(),
      allocation: allocation ?? undefined,
      notes: notes ?? undefined,
      requestedBy,
      clientName,
    });
  }

  return Response.json({ sent: true });
}
