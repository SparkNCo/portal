// @ts-nocheck
import { supabase } from "../client.ts";
import { escapeIlike } from "../utils/slug.ts";

// Checked before creating any new user, of any role, from any flow (admin
// adding a developer/stakeholder/customer, or a customer adding an internal
// developer) — a match here means this email is already taken, so creation
// must fail cleanly instead of what createUser.ts/createCustomerFlow.ts used
// to do: silently reuse the existing Auth account and overwrite its `users`
// row with whatever the new form submitted.
export async function assertEmailNotTaken(schema: string, email: string): Promise<void> {
  const { data: existingRow, error } = await supabase
    .schema(schema)
    .from("users")
    .select("id")
    .ilike("email", escapeIlike(email))
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (existingRow) throw new Error("A user with this email already exists");
}
