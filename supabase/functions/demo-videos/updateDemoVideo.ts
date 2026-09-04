// @ts-nocheck
import { supabase } from "../client.ts";
import {
  BUCKET,
  SCHEMA,
  detectEmbedProvider,
  getDemoSourceFields,
  getFileExtension,
  getUserIdByEmail,
  isStoragePathInUseElsewhere,
  signStorageUrl,
  validateEmbedUrl,
  validateMediaFile,
} from "./helpers.ts";

const loadDemoVideo = async (demoId: string) => {
  const { data, error } = await supabase
    .schema(SCHEMA)
    .from("demo_videos")
    .select("*")
    .eq("id", demoId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Demo version not found");

  return data;
};

const removeOldStorageObject = async (storagePath: string | null) => {
  if (!storagePath) return;

  const { error } = await supabase.storage.from(BUCKET).remove([storagePath]);

  if (error) {
    // Don't fail the request because the DB update already succeeded.
    console.error(
      "[demo-videos] Failed to remove old storage object:",
      error,
    );
  }
};

// Same as above, but first checks no *other* demo_videos row still points
// at this storage path — "select an existing demo video" lets several
// issues' rows share one uploaded file, so blindly deleting it here would
// silently break playback on every other ticket that video was attached to.
const removeOldStorageObjectIfUnused = async (
  storagePath: string | null,
  currentDemoId: string,
) => {
  if (!storagePath) return;
  const stillReferenced = await isStoragePathInUseElsewhere(
    supabase,
    storagePath,
    currentDemoId,
  );
  if (stillReferenced) return;
  await removeOldStorageObject(storagePath);
};

/*
 * Replace an EXISTING version's content with an uploaded file.
 *
 * We intentionally don't overwrite the old object immediately. That way,
 * if the DB update fails, the old version remains intact.
 */
export const updateDemoVideoWithUpload = async (
  demoId: string,
  email: string,
  file: File,
) => {
  validateMediaFile(file);

  const uploadedBy = await getUserIdByEmail(supabase, email);
  const existing = await loadDemoVideo(demoId);

  const fileExtension = getFileExtension(file.name, file.type);
  const newStoragePath = `${existing.issue_id}/v${existing.version}/${crypto.randomUUID()}${fileExtension}`;
  const fileBuffer = await file.arrayBuffer();

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(newStoragePath, fileBuffer, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) throw new Error(uploadError.message);

  const { data: updated, error: updateError } = await supabase
    .schema(SCHEMA)
    .from("demo_videos")
    .update({
      source_type: "upload",
      file_name: file.name,
      storage_path: newStoragePath,
      embed_url: null,
      embed_provider: null,
      uploaded_by: uploadedBy,
      updated_at: new Date().toISOString(),
    })
    .eq("id", demoId)
    .select("*, uploader:users!uploaded_by(id, email, userName)")
    .single();

  if (updateError) {
    await supabase.storage.from(BUCKET).remove([newStoragePath]);
    throw new Error(updateError.message);
  }

  if (existing.source_type === "upload") {
    await removeOldStorageObjectIfUnused(existing.storage_path, demoId);
  }

  return { ...updated, file_url: await signStorageUrl(supabase, newStoragePath) };
};

/*
 * Replace an EXISTING version's content with an embed link.
 */
export const updateDemoVideoWithEmbed = async (
  demoId: string,
  email: string,
  embedUrl: string,
) => {
  validateEmbedUrl(embedUrl);

  const uploadedBy = await getUserIdByEmail(supabase, email);
  const existing = await loadDemoVideo(demoId);

  const { data: updated, error: updateError } = await supabase
    .schema(SCHEMA)
    .from("demo_videos")
    .update({
      source_type: "embed",
      embed_url: embedUrl,
      embed_provider: detectEmbedProvider(embedUrl),
      file_name: null,
      file_url: null,
      storage_path: null,
      uploaded_by: uploadedBy,
      updated_at: new Date().toISOString(),
    })
    .eq("id", demoId)
    .select("*, uploader:users!uploaded_by(id, email, userName)")
    .single();

  if (updateError) throw new Error(updateError.message);

  if (existing.source_type === "upload") {
    await removeOldStorageObjectIfUnused(existing.storage_path, demoId);
  }

  return updated;
};

/*
 * Replace an EXISTING version's content with another already-uploaded demo
 * (from this issue or another one) — no re-upload, just repoint this row at
 * the same storage object / embed link.
 */
export const updateDemoVideoWithExisting = async (
  demoId: string,
  email: string,
  sourceDemoId: string,
) => {
  const uploadedBy = await getUserIdByEmail(supabase, email);
  const existing = await loadDemoVideo(demoId);
  const source = await getDemoSourceFields(supabase, sourceDemoId);

  const { data: updated, error: updateError } = await supabase
    .schema(SCHEMA)
    .from("demo_videos")
    .update({
      source_type: source.source_type,
      file_name: source.file_name,
      storage_path: source.storage_path,
      embed_url: source.embed_url,
      embed_provider: source.embed_provider,
      uploaded_by: uploadedBy,
      updated_at: new Date().toISOString(),
    })
    .eq("id", demoId)
    .select("*, uploader:users!uploaded_by(id, email, userName)")
    .single();

  if (updateError) throw new Error(updateError.message);

  if (existing.source_type === "upload") {
    await removeOldStorageObjectIfUnused(existing.storage_path, demoId);
  }

  return {
    ...updated,
    file_url:
      updated.source_type === "upload"
        ? await signStorageUrl(supabase, updated.storage_path)
        : null,
  };
};
