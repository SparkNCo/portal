// @ts-nocheck
import { supabase } from "../client.ts";

export const listDesignResources = async (url: URL, schema: string) => {
  const issueId = url.searchParams.get("issue_id");
  const projectSlug = url.searchParams.get("project_slug");

  let query = supabase
    .schema(schema)
    .from("design_resources")
    .select("*")
    .order("created_at", { ascending: false });

  if (issueId) {
    query = query.eq("issue_id", issueId);
  }

  if (projectSlug) {
    query = query.eq("project_slug", projectSlug);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[listDesignResources] query failed", error.message);
    throw new Error(error.message);
  }

  return data || [];
};
