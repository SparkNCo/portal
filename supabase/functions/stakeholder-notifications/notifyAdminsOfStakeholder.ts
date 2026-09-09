// @ts-nocheck
import { supabase } from "../client.ts";
import { sendStakeholderAddedMail } from "./sendStakeholderAddedMail.ts";

// POST /stakeholder-notifications — fired (best-effort, from the frontend)
// right after a client/stakeholder self-adds a stakeholder from Settings →
// Stakeholders. Purely informational: unlike developer-requests, this never
// blocks or gates the creation — the stakeholder is already created and
// assigned by the time this runs, admins just get visibility into it.
export async function notifyAdminsOfStakeholder(req: Request): Promise<Response> {
  const { stakeholderEmail, stakeholderName, clientName, addedBy } = await req.json();

  if (!stakeholderEmail) {
    return Response.json({ error: "Missing stakeholderEmail" }, { status: 400 });
  }

  const { data: admins, error } = await supabase
    .schema("portal")
    .from("users")
    .select("email, role")
    .eq("role", "admin");

  if (error) {
    console.error("[notifyAdminsOfStakeholder] ❌ Error fetching admins:", error);
    return Response.json(
      { error: "Failed to look up admins", details: error.message },
      { status: 500 },
    );
  }

  if (!admins || admins.length === 0) {
    console.warn("[notifyAdminsOfStakeholder] ⚠️ No matching admin found");
    return Response.json({ error: "No admin recipient found" }, { status: 404 });
  }

  for (const admin of admins) {
    await sendStakeholderAddedMail({
      email: admin.email,
      stakeholderEmail: String(stakeholderEmail).trim(),
      stakeholderName: stakeholderName ?? undefined,
      clientName,
      addedBy,
    });
  }

  return Response.json({ sent: true });
}
