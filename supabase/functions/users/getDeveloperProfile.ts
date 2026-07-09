// @ts-nocheck
import { supabase } from "../client.ts";

export const getDeveloperProfile = async (userId: string, schema: string) => {
  if (!userId) {
    throw new Error("userId is required");
  }

  const { data, error } = await supabase.schema(schema)
    .from("developers")
    .select("bio, tech_stack")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);

  return {
    bio: data?.bio ?? null,
    tech_stack: data?.tech_stack ?? [],
  };
};
