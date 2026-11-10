// @ts-nocheck
// Who may ask the global query about a client (SPA-582). Checked here, on
// the server, from the caller's session — not left to the page: the question
// reads that client's documents, tests and issues.
//
// The same people who see the client's Dashboard (lib/route-access.ts):
// admins (any client), the client's own customer user, and stakeholders
// assigned to it. Developers can't open the Dashboard, so not for now.
import { supabase } from "../client.ts";
import { escapeIlike } from "../utils/slug.ts";

const SCHEMA = "portal";

export type AskClient = { customerId: string; clientName: string; linearSlug: string };

export type AskCaller = { id: string; role: string | null; customerId: string | null };

// The client a route slug names: its clientName (the route slug) or, for
// older links, its linear_slug — compared ignoring case.
export async function findClient(slug: string): Promise<AskClient | null> {
  const escaped = escapeIlike(slug.trim());
  const { data, error } = await supabase.schema(SCHEMA)
    .from("customers")
    .select("customer_id, clientName, linear_slug")
    .or(`clientName.ilike.${escaped},linear_slug.ilike.${escaped}`)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.customer_id || !data.linear_slug) return null;
  return { customerId: data.customer_id, clientName: data.clientName, linearSlug: data.linear_slug };
}

export async function canAsk(caller: AskCaller, client: AskClient): Promise<boolean> {
  if (caller.role === "admin") return true;
  if (caller.role === "customer") return caller.customerId === client.customerId;
  if (caller.role !== "stakeholder") return false;

  // Stakeholders are assigned to the client's customer *user* (assignments.customer_id).
  const { data: customerUsers, error: usersError } = await supabase.schema(SCHEMA)
    .from("users")
    .select("id")
    .eq("customer_id", client.customerId)
    .eq("role", "customer");
  if (usersError) throw new Error(usersError.message);
  const customerUserIds = (customerUsers ?? []).map((u) => u.id);
  if (customerUserIds.length === 0) return false;

  const { data: assignment, error } = await supabase.schema(SCHEMA)
    .from("assignments")
    .select("id")
    .eq("user_id", caller.id)
    .eq("role", "stakeholder")
    .in("customer_id", customerUserIds)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return !!assignment;
}
