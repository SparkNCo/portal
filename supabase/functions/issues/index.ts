// @ts-nocheck
import { corsHeaders } from "../utils/headers.ts";
import { handleGetIssues } from "./fetchIssues.ts";
import { handleAddComment, handlePostToLinear, handleSetDecision, handleUpdateState, handleUpdateIssue, handleGetProjects, handleGetMilestones, handleCreateMilestone, handleGetLabels, handleMarkIssueSeen } from "./updateIsste.ts";
import {
  handleCreateIssue,
  handleCreateProject,
  handleRequestUpload,
  handleCreateAttachment,
} from "./createIssue.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    let res: Response;
    const pathname = new URL(req.url).pathname;

    if (req.method === "GET" && pathname.endsWith("/projects")) {
      res = await handleGetProjects(req);
    } else if (req.method === "GET" && pathname.endsWith("/milestones")) {
      res = await handleGetMilestones(req);
    } else if (req.method === "GET" && pathname.endsWith("/labels")) {
      res = await handleGetLabels(req);
    } else if (req.method === "GET") {
      res = await handleGetIssues(req);
    } else if (req.method === "POST" && pathname.endsWith("/milestone")) {
      res = await handleCreateMilestone(req);
    } else if (req.method === "POST" && pathname.endsWith("/project")) {
      res = await handleCreateProject(req);
    } else if (req.method === "POST" && pathname.endsWith("/create")) {
      res = await handleCreateIssue(req);
    } else if (req.method === "POST" && pathname.endsWith("/upload")) {
      res = await handleRequestUpload(req);
    } else if (req.method === "POST" && pathname.endsWith("/attachment")) {
      res = await handleCreateAttachment(req);
    } else if (req.method === "POST" && pathname.endsWith("/linear-comment")) {
      res = await handlePostToLinear(req);
    } else if (req.method === "POST" && pathname.endsWith("/seen")) {
      res = await handleMarkIssueSeen(req);
    } else if (req.method === "POST") {
      res = await handleAddComment(req);
    } else if (req.method === "PATCH" && pathname.endsWith("/decision")) {
      res = await handleSetDecision(req);
    } else if (req.method === "PATCH" && pathname.endsWith("/edit")) {
      res = await handleUpdateIssue(req);
    } else if (req.method === "PATCH") {
      res = await handleUpdateState(req);
    } else {
      res = Response.json({ error: "Method not allowed" }, { status: 405 });
    }

    return new Response(res.body, {
      status: res.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[Issues API Error]", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
