// @ts-nocheck
import { supabase } from "../client.ts";

export const deleteDesignResource = async (req: Request, schema: string) => {
  const body = await req.json();

  const { id } = body;

  if (!id) throw new Error("id is required");

  const { error } = await supabase
    .schema(schema)
    .from("design_resources")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("[deleteDesignResource] delete failed", error.message);
    throw new Error(error.message);
  }

  return { success: true, id };
};
