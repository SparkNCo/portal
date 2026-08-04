// @ts-nocheck

import { corsHeaders } from "../utils/headers.ts";
import { jsonResponse } from "./helpers.ts";
import { listDemoVideos } from "./listDemoVideos.ts";
import {
  createDemoVideoFromEmbed,
  createDemoVideoFromUpload,
} from "./createDemoVideo.ts";
import {
  updateDemoVideoWithEmbed,
  updateDemoVideoWithUpload,
} from "./updateDemoVideo.ts";
import { listComments } from "./listComments.ts";
import { createComment } from "./createComment.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const isComments = url.searchParams.get("type") === "comments";

    if (req.method === "GET") {
      if (isComments) {
        return await handleGetComments(url);
      }
      return await handleGetVideos(url);
    }

    if (req.method === "POST") {
      if (isComments) {
        return await handlePostComment(req);
      }
      return await handlePostVideo(req);
    }

    if (req.method === "PUT") {
      return await handlePutVideo(req);
    }

    return jsonResponse({ error: "Method not allowed" }, 405);
  } catch (error) {
    console.error("[demo-videos] Error:", error);

    return jsonResponse(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      500,
    );
  }
});

// ============================================================
// Videos
// ============================================================

const handleGetVideos = async (url: URL) => {
  const issueId = url.searchParams.get("issue_id");

  if (!issueId) {
    return jsonResponse({ error: "issue_id is required" }, 400);
  }

  return jsonResponse(await listDemoVideos(issueId));
};

const handlePostVideo = async (req: Request) => {
  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await req.formData();

    const file = formData.get("file");
    const issueId = formData.get("issue_id");
    const email = formData.get("email");

    if (!(file instanceof File)) {
      return jsonResponse({ error: "A video file is required" }, 400);
    }
    if (!issueId || typeof issueId !== "string") {
      return jsonResponse({ error: "issue_id is required" }, 400);
    }
    if (!email || typeof email !== "string") {
      return jsonResponse({ error: "email is required" }, 400);
    }

    return jsonResponse(
      await createDemoVideoFromUpload(issueId, email, file),
      201,
    );
  }

  const { issue_id, email, embed_url } = await req.json();

  if (!issue_id) return jsonResponse({ error: "issue_id is required" }, 400);
  if (!email) return jsonResponse({ error: "email is required" }, 400);
  if (!embed_url) return jsonResponse({ error: "embed_url is required" }, 400);

  return jsonResponse(
    await createDemoVideoFromEmbed(issue_id, email, embed_url),
    201,
  );
};

const handlePutVideo = async (req: Request) => {
  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await req.formData();

    const file = formData.get("file");
    const demoId = formData.get("demo_id");
    const email = formData.get("email");

    if (!(file instanceof File)) {
      return jsonResponse({ error: "A video file is required" }, 400);
    }
    if (!demoId || typeof demoId !== "string") {
      return jsonResponse({ error: "demo_id is required" }, 400);
    }
    if (!email || typeof email !== "string") {
      return jsonResponse({ error: "email is required" }, 400);
    }

    return jsonResponse(await updateDemoVideoWithUpload(demoId, email, file));
  }

  const { demo_id, email, embed_url } = await req.json();

  if (!demo_id) return jsonResponse({ error: "demo_id is required" }, 400);
  if (!email) return jsonResponse({ error: "email is required" }, 400);
  if (!embed_url) return jsonResponse({ error: "embed_url is required" }, 400);

  return jsonResponse(
    await updateDemoVideoWithEmbed(demo_id, email, embed_url),
  );
};

// ============================================================
// Comments (per-version feedback thread)
// ============================================================

const handleGetComments = async (url: URL) => {
  const demoVideoId = url.searchParams.get("demo_video_id");

  if (!demoVideoId) {
    return jsonResponse({ error: "demo_video_id is required" }, 400);
  }

  return jsonResponse(await listComments(demoVideoId));
};

const handlePostComment = async (req: Request) => {
  const { demo_video_id, email, body } = await req.json();

  if (!demo_video_id) {
    return jsonResponse({ error: "demo_video_id is required" }, 400);
  }
  if (!email) return jsonResponse({ error: "email is required" }, 400);
  if (!body) return jsonResponse({ error: "body is required" }, 400);

  return jsonResponse(await createComment(demo_video_id, email, body), 201);
};
