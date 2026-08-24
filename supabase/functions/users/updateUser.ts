// @ts-nocheck
import { supabase } from "../client.ts";
import { resolveCaller } from "./resolveCaller.ts";

// Email changes touch Supabase Auth (the login credential), not just the
// `users` row, so — unlike every other field this endpoint updates — they
// need a real permission check: admins may edit anyone; a customer may only
// fix a teammate's email if that teammate is staffed on one of their own
// initiatives (`assignments.customer_id`). Developers — internal or
// spark_fde — never qualify.
async function assertCanChangeEmail(req: Request | undefined, schema: string, targetUserId: string) {
  const caller = req ? await resolveCaller(req, schema) : null;
  if (!caller) throw new Error("Unauthorized");
  if (caller.role === "admin") return;

  if (caller.role === "customer" && caller.customerId) {
    const { data: targetAssignments, error: targetError } = await supabase
      .schema(schema)
      .from("assignments")
      .select("customer_id")
      .eq("user_id", targetUserId);
    if (targetError) throw new Error(targetError.message);

    const isOwnTeamMember = (targetAssignments ?? []).some(
      (a) => a.customer_id === caller.customerId,
    );
    if (isOwnTeamMember) return;
  }

  throw new Error("You don't have permission to edit this user's email");
}

export const updateUser = async (body: any, schema: string, req?: Request) => {
  const { id, ...fields } = body;

  if (!id) {
    throw new Error("User id is required for update");
  }

  if (fields.email) {
    await assertCanChangeEmail(req, schema, id);

    const { error: authUpdateError } = await supabase.auth.admin.updateUserById(id, {
      email: fields.email,
    });
    if (authUpdateError) {
      throw new Error(`Failed to update login email: ${authUpdateError.message}`);
    }
  }

  const { data, error } = await supabase.schema(schema)
    .from("users")
    .update(fields)
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(error.message);

  return data;
};
