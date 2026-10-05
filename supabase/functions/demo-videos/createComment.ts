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

  await notifyDemoFeedback({
    demoVideoId,
    email,
    authorRole: data.author?.role,
    body: trimmedBody,
    action: "demo_comment_added",
    slug,
    issueCode,
    issueType,
  });

  return data;
};

// Shared by posting and editing feedback. Flags the ticket as updated, then
// notifies: always whoever uploaded this version (normally its developer),
// and on top of that the other side of the project —
// - customer/stakeholder feedback → also every admin
// - admin feedback → also the initiative's customer + stakeholders
// - developer feedback (uploader or not) → both of the above
// notifyUsers drops the commenter, so they never get their own comment. Both
// actions use objectType "demo_comment", so an edit re-points a recipient's
// still-unread feedback notification instead of adding a second one.
export const notifyDemoFeedback = async ({
  demoVideoId,
  email,
  authorRole,
  body,
  action,
  slug,
  issueCode,
  issueType,
}: {
  demoVideoId: string;
  email: string;
  authorRole?: string;
  body: string;
  action: "demo_comment_added" | "demo_comment_edited";
  slug?: string;
  issueCode?: string;
  issueType?: string;
}) => {
  const { data: video } = await supabase
    .schema(SCHEMA)
    .from("demo_videos")
    .select("issue_id, uploaded_by")
    .eq("id", demoVideoId)
    .maybeSingle();

  if (video?.issue_id) await markIssueUpdated(video.issue_id, email);

  if (slug && video) {
    const isDeveloper = authorRole === "developer";
    // Fire-and-forget so notifications don't delay the response.
    EdgeRuntime.waitUntil(notifyUsers({
      userIds: [video.uploaded_by],
      includeAdmins: authorRole === "customer" || authorRole === "stakeholder" || isDeveloper,
      includeClientOf: authorRole === "admin" || isDeveloper ? slug : undefined,
      actorEmail: email,
      action,
      objectType: "demo_comment",
      objectId: demoVideoId,
      link: resolveIssueDashboardLink(slug, issueType),
      preview: body.slice(0, 200),
      issueCode,
      issueId: video.issue_id,
    }));
  }
};
