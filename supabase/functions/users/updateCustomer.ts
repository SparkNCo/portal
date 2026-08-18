// @ts-nocheck
import { supabase } from "../client.ts";
import { escapeIlike } from "../utils/slug.ts";

// Trims and validates a candidate clientName, enforcing the same
// case-insensitive uniqueness rule as createCustomerFlow — clientName
// doubles as a display/URL key elsewhere, so two customers differing only
// by case would collide.
async function resolveClientName(
  schema: string,
  customerId: string,
  clientName: unknown,
): Promise<string> {
  const trimmedClientName =
    typeof clientName === "string" ? clientName.trim() : "";
  if (!trimmedClientName) throw new Error("clientName cannot be empty");

  const { data: existingClient, error: existingClientError } = await supabase
    .schema(schema)
    .from("customers")
    .select("customer_id")
    .ilike("clientName", escapeIlike(trimmedClientName))
    .neq("customer_id", customerId)
    .maybeSingle();

  if (existingClientError) throw new Error(existingClientError.message);
  if (existingClient)
    throw new Error(`A customer named "${trimmedClientName}" already exists`);

  return trimmedClientName;
}

// Updates fields on the `customers` record itself (as opposed to `updateUser`,
// which only touches the `users` table) — Stripe Customer ID (Settings/Billing)
// and clientName (set-password, so a customer's display name can be fixed up
// the first time they log in). Only touches fields actually present in the
// body, so e.g. a clientName-only call never wipes out an existing Stripe ID.
export const updateCustomer = async (body: any, schema: string) => {
  const { customer_id, stripe_customer_id, clientName } = body;

  if (!customer_id) {
    throw new Error("customer_id is required");
  }

  const updateFields: Record<string, string | null> = {};

  if (stripe_customer_id !== undefined) {
    updateFields.stripe_customer_id =
      typeof stripe_customer_id === "string" && stripe_customer_id.trim()
        ? stripe_customer_id.trim()
        : null;
  }

  if (clientName !== undefined) {
    updateFields.clientName = await resolveClientName(schema, customer_id, clientName);
  }

  if (Object.keys(updateFields).length === 0) {
    throw new Error("No fields to update");
  }

  const { data, error } = await supabase.schema(schema)
    .from("customers")
    .update(updateFields)
    .eq("customer_id", customer_id)
    .select()
    .single();

  if (error) throw new Error(error.message);

  return data;
};
