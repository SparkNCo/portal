// @ts-nocheck
import { supabase } from "../client.ts";

// Managing suggestions is a product decision: admins, customers and
// stakeholders only. Enforced server-side because these endpoints take a bare
// `id` with no other ownership check.
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
