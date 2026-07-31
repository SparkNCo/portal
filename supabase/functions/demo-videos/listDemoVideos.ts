// @ts-nocheck
import { supabase } from "../client.ts";
import { SCHEMA, signStorageUrl } from "./helpers.ts";

export const listDemoVideos = async (issueId: string) => {
  const { data, error } = await supabase
    .schema(SCHEMA)
    .from("demo_videos")
    .select("*, uploader:users!uploaded_by(id, email, userName)")
    .eq("issue_id", issueId)
    .order("version", { ascending: false });

  if (error) throw new Error(error.message);
  if (!data) return [];

  return Promise.all(
    data.map(async (demo) => ({
      ...demo,
      file_url:
        demo.source_type === "upload"
          ? await signStorageUrl(supabase, demo.storage_path)
          : null,
    })),
  );
};
