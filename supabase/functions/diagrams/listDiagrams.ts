// @ts-nocheck
import { supabase } from "../client.ts";

export const listDiagrams = async (url: URL, schema: string) => {
  const type = url.searchParams.get("type");

  // 🔹 Services for this project — powers the "use existing service"
  // dropdown. Every row here always has ≥1 diagram, since a service is
  // only ever created together with its first diagram (see createDiagram.ts).
  if (type === "services") {
    const projectSlug = url.searchParams.get("project_slug");
    if (!projectSlug) throw new Error("project_slug is required");

    const { data, error } = await supabase.schema(schema)
      .from("services")
      .select("*")
      .eq("project_slug", projectSlug)
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);

    return data;
  }

  const serviceId = url.searchParams.get("service_id");
  const issueId = url.searchParams.get("issue_id");

  if (!serviceId && !issueId) {
    throw new Error("service_id or issue_id is required");
  }

  let query = supabase.schema(schema)
    .from("diagrams")
    .select("*")
    .order("version", { ascending: false });

  query = serviceId ? query.eq("service_id", serviceId) : query.eq("issue_id", issueId);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return data;
};
