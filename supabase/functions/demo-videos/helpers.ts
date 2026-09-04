// @ts-nocheck
import { corsHeaders } from "../utils/headers.ts";

export const SCHEMA = "portal";
export const BUCKET = "demo-videos";
export const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500 MB

// The demo-videos bucket is private, so playback URLs are short-lived
// signed URLs generated on read rather than a permanent public URL.
export const SIGNED_URL_EXPIRY_SECONDS = 60 * 60; // 1 hour

export const signStorageUrl = async (
  supabase: any,
  storagePath: string | null,
): Promise<string | null> => {
  if (!storagePath) return null;

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_EXPIRY_SECONDS);

  if (error) {
    console.error("[demo-videos] Failed to sign storage URL:", error);
    return null;
  }

  return data.signedUrl;
};

export const ALLOWED_VIDEO_TYPES = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-msvideo",
  "video/x-matroska",
  "video/mpeg",
  "video/ogg",
]);

export const ALLOWED_IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);

export const ALLOWED_MEDIA_TYPES = new Set([
  ...ALLOWED_VIDEO_TYPES,
  ...ALLOWED_IMAGE_TYPES,
]);

export const validateMediaFile = (file: File) => {
  if (!file.type || !ALLOWED_MEDIA_TYPES.has(file.type)) {
    throw new Error(
      "Invalid file format. Supported formats: MP4, WebM, MOV, AVI, MKV, MPEG, OGG, PNG, JPEG, WebP and GIF.",
    );
  }

  if (file.size <= 0) {
    throw new Error("The uploaded file is empty.");
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error(
      `The file is too large. Maximum allowed size is ${MAX_FILE_SIZE / (1024 * 1024)} MB.`,
    );
  }
};

export const getFileExtension = (fileName: string, mimeType: string) => {
  const existingExtension = /\.[a-z0-9]+$/i.exec(fileName)?.[0];

  if (existingExtension) {
    return existingExtension.toLowerCase();
  }

  const mimeExtensions: Record<string, string> = {
    "video/mp4": ".mp4",
    "video/webm": ".webm",
    "video/quicktime": ".mov",
    "video/x-msvideo": ".avi",
    "video/x-matroska": ".mkv",
    "video/mpeg": ".mpeg",
    "video/ogg": ".ogv",
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/webp": ".webp",
    "image/gif": ".gif",
  };

  return mimeExtensions[mimeType] ?? ".mp4";
};

const LOOM_HOSTS = new Set(["loom.com", "www.loom.com"]);

export const validateEmbedUrl = (embedUrl: string) => {
  let parsed: URL;

  try {
    parsed = new URL(embedUrl);
  } catch {
    throw new Error("Enter a valid video URL");
  }

  if (parsed.protocol !== "https:") {
    throw new Error("Embed URL must use https");
  }

  return parsed;
};

export const detectEmbedProvider = (embedUrl: string): string => {
  const parsed = validateEmbedUrl(embedUrl);

  if (LOOM_HOSTS.has(parsed.hostname)) return "loom";

  return parsed.hostname.replace(/^www\./, "");
};

// Fields that define a demo version's actual playable content, as opposed
// to bookkeeping (id/issue_id/version/uploaded_by/timestamps). Copying just
// these onto a new/updated row is what lets one uploaded file or embed link
// be attached to several issues at once ("select an existing demo video")
// without re-uploading it.
export const getDemoSourceFields = async (supabase: any, demoId: string) => {
  const { data, error } = await supabase
    .schema(SCHEMA)
    .from("demo_videos")
    .select("source_type, file_name, storage_path, embed_url, embed_provider")
    .eq("id", demoId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Source demo video not found");

  return data as {
    source_type: "upload" | "embed";
    file_name: string | null;
    storage_path: string | null;
    embed_url: string | null;
    embed_provider: string | null;
  };
};

// Several issues' demo_videos rows can share the same storage_path (that's
// how "attach this same video to another ticket" works) — so a storage
// object is only safe to delete once no *other* row still points at it.
export const isStoragePathInUseElsewhere = async (
  supabase: any,
  storagePath: string,
  excludingDemoId: string,
): Promise<boolean> => {
  const { data, error } = await supabase
    .schema(SCHEMA)
    .from("demo_videos")
    .select("id")
    .eq("storage_path", storagePath)
    .neq("id", excludingDemoId)
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return !!data;
};

export const getUserIdByEmail = async (
  supabase: any,
  email: string,
): Promise<string> => {
  const { data: user, error } = await supabase
    .schema(SCHEMA)
    .from("users")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!user) throw new Error("User not found");

  return user.id;
};

export const jsonResponse = (data: unknown, status = 200) => {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
};
