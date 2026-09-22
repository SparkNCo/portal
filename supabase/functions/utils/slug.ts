// @ts-nocheck
import { supabase } from "../client.ts";

// Escapes Postgres ILIKE wildcard metacharacters (`%`, `_`) and the escape
// character itself (`\`) in request-supplied values before they're used in
// an `.ilike()`/`ilike.` filter. Without this, a slug of e.g. "%" or "a%"
// turns a case-insensitive *exact* match into a pattern match against every
// (or arbitrary) row — this keeps `ilike` doing case-insensitive equality
// only, never pattern matching.
export function escapeIlike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

// slug (clientName-based route slug) -> the customer's own portal.users.id
// (role='customer') — the id space `assignments`/`chat_participants`/
// `notifications` all key membership by. Used wherever a developer/admin
// only has a route slug in hand but needs to resolve "which customer does
// this belong to" (originally duplicated in notify.ts's notifyProject and
// chats/getOrCreateIssueChat.ts — pulled out here once both needed it).
export async function resolveCustomerUserIdBySlug(
  schema: string,
  slug: string,
): Promise<string | undefined> {
  const { data: customer, error: customerError } = await supabase.schema(schema)
    .from("customers")
    .select("customer_id")
    .ilike("clientName", escapeIlike(slug))
    .maybeSingle();
  if (customerError) throw new Error(customerError.message);
  if (!customer?.customer_id) return undefined;

  const { data: customerUser, error: customerUserError } = await supabase.schema(schema)
    .from("users")
    .select("id")
    .eq("customer_id", customer.customer_id)
    .eq("role", "customer")
    .maybeSingle();
  if (customerUserError) throw new Error(customerUserError.message);

  return customerUser?.id;
}
