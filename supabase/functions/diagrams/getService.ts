// @ts-nocheck
import { supabase } from "../client.ts";

export const getService = async (id: string, project_slug: string, schema: string) => {
  const { data, error } = await supabase.schema(schema)
    .from("services")
    .select("*")
    .eq("id", id)
    .eq("project_slug", project_slug)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Service not found for this project");

  return data;
};
