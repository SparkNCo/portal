// @ts-nocheck
import { supabase } from "../client.ts";
import { SCHEMA } from "./helpers.ts";

export const listComments = async (demoVideoId: string) => {
  const { data, error } = await supabase
    .schema(SCHEMA)
    .from("demo_video_comments")
    .select("*, author:users!author_id(id, email, userName, role)")
    .eq("demo_video_id", demoVideoId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);

  return data ?? [];
};
