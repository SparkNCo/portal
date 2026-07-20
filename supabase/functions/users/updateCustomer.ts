// @ts-nocheck
import { supabase } from "../client.ts";

// Updates fields on the `customers` record itself (as opposed to `updateUser`,
// which only touches the `users` table) — currently just the Stripe Customer
// ID, settable from Settings/Billing by an admin.
export const updateCustomer = async (body: any, schema: string) => {
  const { customer_id, stripe_customer_id } = body;

  if (!customer_id) {
    throw new Error("customer_id is required");
  }

  const normalizedStripeId =
    typeof stripe_customer_id === "string" && stripe_customer_id.trim()
      ? stripe_customer_id.trim()
      : null;

  const { data, error } = await supabase.schema(schema)
    .from("customers")
    .update({ stripe_customer_id: normalizedStripeId })
    .eq("customer_id", customer_id)
    .select()
    .single();

  if (error) throw new Error(error.message);

  return data;
};
