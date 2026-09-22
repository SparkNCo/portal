// @ts-nocheck
import { supabase } from "../client.ts";

// Role-based membership resolution, ported from useCometChat.ts's
// createSupportGroup: a customer's chat includes everyone assigned to them
// (developers + stakeholders); a stakeholder's chat includes their own
// customer(s) plus that customer's developers; a developer/admin creating a
// chat for a specific customer includes that customer + its assignees.
//
// Unlike CometChat, there's no "fixed owner" account added here — admins
// bypass chat_participants entirely in RLS (see the migration), so they
// don't need to be seeded as a participant to have access.
export async function resolveParticipants(
  profile: { id: string; role: string },
  customerId?: string,
): Promise<{ resolvedCustomerId?: string; participantIds: Set<string> }> {
  const schema = "portal";
  const participantIds = new Set<string>([profile.id]);
  let resolvedCustomerId: string | undefined =
    profile.role === "customer" ? profile.id : customerId;

  if (profile.role === "stakeholder") {
    const { data: own, error } = await supabase.schema(schema)
      .from("assignments")
      .select("customer_id")
      .eq("user_id", profile.id);
    if (error) throw new Error(error.message);

    const customerIds = [...new Set((own ?? []).map((a) => a.customer_id).filter(Boolean))];
    if (customerIds.length > 0) {
      resolvedCustomerId = customerIds[0];
      customerIds.forEach((id: string) => participantIds.add(id));

      const { data: devs, error: devsError } = await supabase.schema(schema)
        .from("assignments")
        .select("user_id")
        .eq("customer_id", customerIds[0])
        .eq("role", "developer");
      if (devsError) throw new Error(devsError.message);
      (devs ?? []).forEach((a) => a.user_id && participantIds.add(a.user_id));
    }
  } else if (profile.role === "developer" || profile.role === "admin") {
    if (customerId) {
      resolvedCustomerId = customerId;
      participantIds.add(customerId);

      const { data: assignees, error } = await supabase.schema(schema)
        .from("assignments")
        .select("user_id")
        .eq("customer_id", customerId);
      if (error) throw new Error(error.message);
      (assignees ?? []).forEach((a) => a.user_id && participantIds.add(a.user_id));
    }
  } else {
    // Customer: every developer/stakeholder assigned to them.
    const { data: assignees, error } = await supabase.schema(schema)
      .from("assignments")
      .select("user_id")
      .eq("customer_id", profile.id);
    if (error) throw new Error(error.message);
    (assignees ?? []).forEach((a) => a.user_id && participantIds.add(a.user_id));
  }

  return { resolvedCustomerId, participantIds };
}

export async function seedParticipants(chatId: string, userIds: Set<string>) {
  const rows = Array.from(userIds).map((user_id) => ({ chat_id: chatId, user_id }));
  if (!rows.length) return;

  const { error } = await supabase.schema("portal")
    .from("chat_participants")
    .upsert(rows, { onConflict: "chat_id,user_id", ignoreDuplicates: true });
  if (error) throw new Error(error.message);
}
