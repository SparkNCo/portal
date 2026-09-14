// @ts-nocheck
import { supabase } from "../client.ts";

// POST /suggested-features/decline — { id }. No Linear issue is ever created
// for a declined suggestion; this just records the status so it drops out of
// handleListSuggestions' pending-only view.
export async function handleDeclineSuggestion(req: Request): Promise<Response> {
  const schema = "portal";
  const { id } = await req.json();

  if (!id) {
    return Response.json({ error: "Missing id" }, { status: 400 });
  }

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
