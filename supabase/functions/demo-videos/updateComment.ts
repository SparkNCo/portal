// @ts-nocheck
import { supabase } from "../client.ts";
import { SCHEMA, getUserIdByEmail } from "./helpers.ts";
import { notifyDemoFeedback } from "./createComment.ts";

// Only the comment's own author can edit it. Returns null when the comment
// doesn't exist or belongs to someone else (the caller answers 403). An edit
// notifies the same people as the original feedback (see notifyDemoFeedback).
export const updateComment = async (
  commentId: string,
  email: string,
  body: string,
  slug?: string,
  issueCode?: string,
  issueType?: string,
) => {
  const trimmedBody = body.trim();
  if (!trimmedBody) throw new Error("Comment can't be empty");

  const authorId = await getUserIdByEmail(supabase, email);

  const { data, error } = await supabase
    .schema(SCHEMA)
    .from("demo_video_comments")
    .update({ body: trimmedBody })
    .eq("id", commentId)
    .eq("author_id", authorId)
    .select("*, author:users!author_id(id, email, userName, role)")
    .maybeSingle();

  if (error) throw new Error(error.message);

  if (data) {
    await notifyDemoFeedback({
      demoVideoId: data.demo_video_id,
      email,
      authorRole: data.author?.role,
      body: trimmedBody,
      action: "demo_comment_edited",
      slug,
      issueCode,
      issueType,
    });
  }
  return data;
};
