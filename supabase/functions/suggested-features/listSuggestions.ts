// @ts-nocheck
import { supabase } from "../client.ts";
import { resolveLinearSlug } from "../utils/slug.ts";

// GET /suggested-features?slug=... — pending suggestions only, newest first.
// `slug` (route slug) is resolved to linear_slug, which is what project_slug stores.
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
