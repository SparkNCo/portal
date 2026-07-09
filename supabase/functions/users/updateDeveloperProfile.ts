// @ts-nocheck
import { supabase } from "../client.ts";

export const updateDeveloperProfile = async (body: any, schema: string) => {
  const { userId, bio, tech_stack } = body;

  if (!userId) {
    throw new Error("userId is required");
  }

  const { data, error } = await supabase.schema(schema)
    .from("developers")
    .upsert(
      { user_id: userId, bio: bio ?? null, tech_stack: tech_stack ?? [] },
      { onConflict: "user_id" },
    )
    .select("bio, tech_stack")
    .single();

  if (error) throw new Error(error.message);

  return data;
};
