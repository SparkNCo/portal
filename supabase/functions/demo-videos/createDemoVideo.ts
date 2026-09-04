// @ts-nocheck
import { supabase } from "../client.ts";
import { markIssueUpdated } from "../utils/issueUpdates.ts";
import {
  BUCKET,
  SCHEMA,
  detectEmbedProvider,
  getDemoSourceFields,
  getFileExtension,
  getUserIdByEmail,
  signStorageUrl,
  validateEmbedUrl,
  validateMediaFile,
} from "./helpers.ts";

const getNextVersion = async (issueId: string) => {
  const { data: latest, error } = await supabase
    .schema(SCHEMA)
    .from("demo_videos")
    .select("version")
    .eq("issue_id", issueId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);

  return (latest?.version ?? 0) + 1;
};

/*
 * `demo_videos` has a UNIQUE(issue_id, version) constraint, so if two
 * uploads race for the same next version number, the loser's insert
 * fails cleanly instead of silently overwriting/duplicating a version.
 */
const isVersionConflict = (error: { code?: string }) => error.code === "23505";

export const createDemoVideoFromUpload = async (
  issueId: string,
  email: string,
  file: File,
) => {
  validateMediaFile(file);

  const uploadedBy = await getUserIdByEmail(supabase, email);
  const nextVersion = await getNextVersion(issueId);

  const fileExtension = getFileExtension(file.name, file.type);
  const storagePath = `${issueId}/v${nextVersion}/${crypto.randomUUID()}${fileExtension}`;
  const fileBuffer = await file.arrayBuffer();

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, fileBuffer, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) throw new Error(uploadError.message);

  const { data: demo, error: insertError } = await supabase
    .schema(SCHEMA)
    .from("demo_videos")
    .insert({
      issue_id: issueId,
      version: nextVersion,
      source_type: "upload",
      file_name: file.name,
      storage_path: storagePath,
      uploaded_by: uploadedBy,
    })
    .select("*, uploader:users!uploaded_by(id, email, userName)")
    .single();

  if (insertError) {
    await supabase.storage.from(BUCKET).remove([storagePath]);

    if (isVersionConflict(insertError)) {
      throw new Error(
        "Someone else just uploaded a new version — please try again.",
      );
    }

    throw new Error(insertError.message);
  }

  await markIssueUpdated(issueId, email);

  return { ...demo, file_url: await signStorageUrl(supabase, storagePath) };
};

/*
 * Attach an already-uploaded demo (from another issue, or another version
 * of this one) as a brand-new version here — no re-upload, just a new row
 * pointing at the same storage object / embed link. This is how "Demos"
 * (see app/dev/demos/page.tsx) links one uploaded video to several
 * features/bugs at once, and how a ticket's own Demo tab can attach a demo
 * already uploaded elsewhere in the project.
 */
export const createDemoVideoFromExisting = async (
  issueId: string,
  email: string,
  sourceDemoId: string,
) => {
  const uploadedBy = await getUserIdByEmail(supabase, email);
  const source = await getDemoSourceFields(supabase, sourceDemoId);
  const nextVersion = await getNextVersion(issueId);

  const { data: demo, error: insertError } = await supabase
    .schema(SCHEMA)
    .from("demo_videos")
    .insert({
      issue_id: issueId,
      version: nextVersion,
      source_type: source.source_type,
      file_name: source.file_name,
      storage_path: source.storage_path,
      embed_url: source.embed_url,
      embed_provider: source.embed_provider,
      uploaded_by: uploadedBy,
    })
    .select("*, uploader:users!uploaded_by(id, email, userName)")
    .single();

  if (insertError) {
    if (isVersionConflict(insertError)) {
      throw new Error(
        "Someone else just added a new version — please try again.",
      );
    }

    throw new Error(insertError.message);
  }

  await markIssueUpdated(issueId, email);

  return {
    ...demo,
    file_url:
      demo.source_type === "upload"
        ? await signStorageUrl(supabase, demo.storage_path)
        : null,
  };
};

export const createDemoVideoFromEmbed = async (
  issueId: string,
  email: string,
  embedUrl: string,
) => {
  validateEmbedUrl(embedUrl);

  const uploadedBy = await getUserIdByEmail(supabase, email);
  const nextVersion = await getNextVersion(issueId);

  const { data: demo, error: insertError } = await supabase
    .schema(SCHEMA)
    .from("demo_videos")
    .insert({
      issue_id: issueId,
      version: nextVersion,
      source_type: "embed",
      embed_url: embedUrl,
      embed_provider: detectEmbedProvider(embedUrl),
      uploaded_by: uploadedBy,
    })
    .select("*, uploader:users!uploaded_by(id, email, userName)")
    .single();

  if (insertError) {
    if (isVersionConflict(insertError)) {
      throw new Error(
        "Someone else just added a new version — please try again.",
      );
    }

    throw new Error(insertError.message);
  }

  await markIssueUpdated(issueId, email);

  return demo;
};
