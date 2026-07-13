// @ts-nocheck
import { supabase } from "../client.ts";
import { validateDesignResourceUrl } from "./validateUrl.ts";

export const updateDesignResource = async (req: Request, schema: string) => {
  const body = await req.json();

  const { id, title, description, url } = body;

  if (!id) throw new Error("id is required");

  // Build update object
  const updates: any = {};
  if (title !== undefined) updates.title = title || null;
  if (description !== undefined) updates.description = description || null;
  
  // If URL is being updated, validate it
  if (url !== undefined) {
    // First get the existing resource to check its type
    const { data: existing, error: fetchError } = await supabase
      .schema(schema)
      .from("design_resources")
      .select("resource_type")
      .eq("id", id)
      .single();

    if (fetchError) throw new Error(fetchError.message);
    if (!existing) throw new Error("Design resource not found");

    const validation = validateDesignResourceUrl(url, existing.resource_type);
    if (!validation.valid) {
      throw new Error(validation.error || "Invalid URL");
    }

    updates.url = url;
  }

  if (Object.keys(updates).length === 0) {
    throw new Error("No fields to update");
  }

  const { data: resource, error: updateError } = await supabase
    .schema(schema)
    .from("design_resources")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (updateError) {
    console.error("[updateDesignResource] update failed", updateError.message);
    throw new Error(updateError.message);
  }

  return resource;
};
