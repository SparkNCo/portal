// @ts-nocheck
import { supabase } from "../client.ts";

export const updateUser = async (body: any) => {
  const { id, ...fields } = body;

  if (!id) {
    throw new Error("User id is required for update");
  }

  const { data, error } = await supabase
    .from("users")
    .update(fields)
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(error.message);

  return data;
};
