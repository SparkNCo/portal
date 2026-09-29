// @ts-nocheck
import { supabase } from "../client.ts";

// Escapes `%`, `_` and `\` in user input so `.ilike()` stays a case-insensitive
// equality — otherwise a slug like "%" would match every row.
export function escapeIlike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

// Route slug -> the customer's portal.users.id (role='customer'), the id that
// assignments/chat_participants/notifications use.
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

// Route slug -> customers.linear_slug (stable Linear initiative id). Use it for
// anything keyed per customer (vector namespace, sync checkpoints): the route
// slug is editable and inconsistently cased.
export async function resolveLinearSlug(schema: string, slug: string): Promise<string | null> {
  const { data, error } = await supabase.schema(schema)
    .from("customers")
    .select("linear_slug")
    .ilike("clientName", escapeIlike(slug))
    .maybeSingle();

  if (error) {
    console.error("[resolveLinearSlug] lookup failed:", error.message);
    return null;
  }

  return data?.linear_slug ?? null;
}
