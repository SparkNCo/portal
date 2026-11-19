// @ts-nocheck
import { supabase } from "../client.ts";
import { escapeIlike } from "../utils/slug.ts";

// Checked before creating any new user, of any role, from any flow (admin
// adding a developer/stakeholder/customer, or a customer adding an internal
// developer) — a match here means this email is already taken, so creation
// must fail cleanly instead of what createUser.ts/createCustomerFlow.ts used
// to do: silently reuse the existing Auth account and overwrite its `users`
// row with whatever the new form submitted.
//
// Exception: a "lead" (someone who signed in on the marketing site's
// /assessment) isn't a portal user yet. Creating a user with their email
// promotes them: same Auth account and `users` row id, new role. Returns that
// id so the caller reuses the account instead of inviting a new one.
export async function assertEmailNotTaken(schema: string, email: string): Promise<{ leadUserId: string | null }> {
  const { data: existingRow, error } = await supabase
    .schema(schema)
    .from("users")
    .select("id, role")
    .ilike("email", escapeIlike(email))
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!existingRow) return { leadUserId: null };
  if (existingRow.role === "lead") return { leadUserId: existingRow.id };
  throw new Error("A user with this email already exists");
}
