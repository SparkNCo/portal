// @ts-nocheck
import { supabase } from "../client.ts";
import { SCHEMA, signStorageUrl } from "./helpers.ts";

const withSignedUrls = async (data: any[]) =>
  Promise.all(
    data.map(async (demo) => ({
      ...demo,
      file_url:
        demo.source_type === "upload"
          ? await signStorageUrl(supabase, demo.storage_path)
          : null,
    })),
  );

export const listDemoVideos = async (issueId: string) => {
  const { data, error } = await supabase
    .schema(SCHEMA)
    .from("demo_videos")
    .select("*, uploader:users!uploaded_by(id, email, userName)")
    .eq("issue_id", issueId)
    .order("version", { ascending: false });

  if (error) throw new Error(error.message);
  if (!data) return [];

  return withSignedUrls(data);
};

// Powers the "Demos" sidebar tab (app/dev/demos/page.tsx): every demo
// version across a whole project's issues in one query, rather than one
// request per issue. The caller resolves which issue ids belong to the
// project (via GET /issues?slug=...) since demo_videos has no project/slug
// column of its own — issue-to-project ownership lives in Linear.
export const listDemoVideosByIssueIds = async (issueIds: string[]) => {
  if (issueIds.length === 0) return [];

  const { data, error } = await supabase
    .schema(SCHEMA)
    .from("demo_videos")
    .select("*, uploader:users!uploaded_by(id, email, userName)")
    .in("issue_id", issueIds)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  if (!data) return [];

  return withSignedUrls(data);
};
