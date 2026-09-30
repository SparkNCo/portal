// @ts-nocheck
import { supabase } from "../client.ts";
import { markIssueUpdated } from "../utils/issueUpdates.ts";
import { notifyUsers, resolveIssueDashboardLink } from "../utils/notify.ts";
import { SCHEMA, getUserIdByEmail } from "./helpers.ts";

export const createComment = async (
  demoVideoId: string,
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
    .select("issue_id, uploaded_by")
    .eq("id", demoVideoId)
    .maybeSingle();

  if (video?.issue_id) await markIssueUpdated(video.issue_id, email);

  // Feedback always goes to whoever uploaded this version (normally its
  // developer). On top of that it crosses to the other side of the project:
  // - customer/stakeholder feedback → also every admin
  // - admin feedback → also the initiative's customer + stakeholders
  // - developer feedback (uploader or not) → both of the above
  // notifyUsers drops the commenter, so they never get their own comment.
  if (slug && video) {
    const authorRole = data.author?.role;
    const isDeveloper = authorRole === "developer";
    // Fire-and-forget so notifications don't delay the response.
    EdgeRuntime.waitUntil(notifyUsers({
      userIds: [video.uploaded_by],
      includeAdmins: authorRole === "customer" || authorRole === "stakeholder" || isDeveloper,
      includeClientOf: authorRole === "admin" || isDeveloper ? slug : undefined,
      actorEmail: email,
      action: "demo_comment_added",
      objectType: "demo_comment",
      objectId: demoVideoId,
      link: resolveIssueDashboardLink(slug, issueType),
      preview: trimmedBody.slice(0, 200),
      issueCode,
      issueId: video.issue_id,
    }));
  }

  return data;
};
