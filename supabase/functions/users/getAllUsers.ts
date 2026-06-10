// @ts-nocheck
import { supabase } from "../client.ts";

export const getAllUsers = async () => {
  const { data, error } = await supabase.schema("portal").from("users").select("*");

  if (error) throw new Error(error.message);

  return data;
};
