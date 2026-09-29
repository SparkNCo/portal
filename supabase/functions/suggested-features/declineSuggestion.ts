// @ts-nocheck
import { supabase } from "../client.ts";
import { requireNonDeveloper } from "./authorize.ts";

// POST /suggested-features/decline — { id, actorEmail }. Only records the status.
export async function handleDeclineSuggestion(req: Request): Promise<Response> {
  const schema = "portal";
  const { id, actorEmail } = await req.json();

  if (!id || !actorEmail) {
    return Response.json({ error: "Missing id or actorEmail" }, { status: 400 });
  }

  const authError = await requireNonDeveloper(schema, actorEmail);
  if (authError) return authError;

  const { data, error } = await supabase
    .schema(schema)
    .from("suggested_features")
    .update({ status: "declined" })
    .eq("id", id)
    .eq("status", "pending")
    .select()
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) {
    return Response.json(
      { error: "Suggestion not found or already resolved" },
      { status: 404 },
    );
  }

  return Response.json(data);
}
