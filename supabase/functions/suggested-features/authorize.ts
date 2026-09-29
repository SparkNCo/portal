// @ts-nocheck
import { supabase } from "../client.ts";

// Accepting/declining a suggestion (and overriding its milestone) is a
// product/roadmap call, not an engineering one — same category as Business
// Review approval or a UAT sign-off elsewhere in this app, both of which are
// customer/stakeholder/admin actions a developer doesn't get to make
// unilaterally. Checked here server-side (not just hidden in the UI) since
// these endpoints otherwise take a bare `id` with no other ownership check.
const ALLOWED_ROLES = ["admin", "customer", "stakeholder"];

export async function requireNonDeveloper(
  schema: string,
  actorEmail: string,
): Promise<Response | null> {
  const { data: actor, error } = await supabase.schema(schema)
    .from("users")
    .select("role")
    .eq("email", actorEmail)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!actor || !ALLOWED_ROLES.includes(actor.role)) {
    return Response.json(
      { error: "Only admins, customers, or stakeholders can do this" },
      { status: 403 },
    );
  }
  return null;
}
