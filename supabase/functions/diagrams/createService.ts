// @ts-nocheck
import { supabase } from "../client.ts";

export const createService = async (
  project_slug: string,
  name: string,
  created_by: string,
  schema: string,
) => {
  const { data, error } = await supabase.schema(schema)
    .from("services")
    .insert({ project_slug, name, created_by })
    .select()
    .single();

  if (error) throw new Error(error.message);

  return data;
};
