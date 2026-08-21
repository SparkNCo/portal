// @ts-nocheck
import { supabase } from "../client.ts";
import { markIssueUpdated } from "../utils/issueUpdates.ts";
import { SCHEMA, getUserIdByEmail } from "./helpers.ts";

export const createComment = async (
  demoVideoId: string,
  email: string,
  body: string,
) => {
  const trimmedBody = body.trim();

  if (!trimmedBody) throw new Error("Comment can't be empty");

  const authorId = await getUserIdByEmail(supabase, email);

  const { data, error } = await supabase
    .schema(SCHEMA)
    .from("demo_video_comments")
    .insert({
      demo_video_id: demoVideoId,
      author_id: authorId,
      body: trimmedBody,
    })
    .select("*, author:users!author_id(id, email, userName, role)")
    .single();

  if (error) throw new Error(error.message);

  const { data: video } = await supabase
    .schema(SCHEMA)
    .from("demo_videos")
    .select("issue_id")
    .eq("id", demoVideoId)
    .maybeSingle();

  if (video?.issue_id) await markIssueUpdated(video.issue_id, email);

  return data;
};
