// @ts-nocheck
import { supabase } from "../client.ts";

// GET /suggested-features?slug=... — pending suggestions for one customer's
// initiative, newest first. Accepted/declined rows are deliberately excluded
// here (per the ticket: "removes it from the active Build-page view") — they
// still exist in the table, just not returned by this listing.
export async function handleListSuggestions(req: Request): Promise<Response> {
  const schema = "portal";
  const url = new URL(req.url);
  const slug = url.searchParams.get("slug");

  if (!slug) {
    return Response.json({ error: "Missing slug" }, { status: 400 });
  }

  const { data, error } = await supabase
    .schema(schema)
    .from("suggested_features")
    .select("*")
    .eq("project_slug", slug)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  return Response.json(data ?? []);
}
