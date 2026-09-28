// @ts-nocheck
import { supabase } from "../client.ts";
import { resolveLinearSlug } from "../utils/slug.ts";

// GET /suggested-features?slug=... — pending suggestions for one customer's
// initiative, newest first. Accepted/declined rows are deliberately excluded
// here (per the ticket: "removes it from the active Build-page view") — they
// still exist in the table, just not returned by this listing.
//
// `slug` is the caller's clientName-based route slug — resolved to the
// customer's linear_slug before querying, same as handleGenerateSuggestion,
// since that's what's actually stored in `project_slug`.
export async function handleListSuggestions(req: Request): Promise<Response> {
  const schema = "portal";
  const url = new URL(req.url);
  const slug = url.searchParams.get("slug");

  if (!slug) {
    return Response.json({ error: "Missing slug" }, { status: 400 });
  }

  const linearSlug = await resolveLinearSlug(schema, slug);
  if (!linearSlug) return Response.json([]);

  const { data, error } = await supabase
    .schema(schema)
    .from("suggested_features")
    .select("*")
    .eq("project_slug", linearSlug)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  return Response.json(data ?? []);
}
