// @ts-nocheck
import { supabase } from "../client.ts";

export const getAllUsers = async (schema: string) => {
  const { data, error } = await supabase.schema(schema).from("users").select("*");

  if (error) throw new Error(error.message);

  return data;
};
