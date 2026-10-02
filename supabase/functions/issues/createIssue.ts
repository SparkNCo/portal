// @ts-nocheck
import { supabase } from "../client.ts";
import { linearRequest, GET_PROJECT_TEAM_QUERY, GET_TEAM_LABELS_QUERY, GET_INITIATIVE_PROJECTS_QUERY } from "./linearClient.ts";
import { escapeIlike } from "../utils/slug.ts";
import { upsertIssueVector } from "../lib/vector.ts";

const GET_FIRST_TEAM_QUERY = `
  query GetFirstTeam {
    teams(first: 1) { nodes { id } }
  }
`;

// Also used by suggested-features/acceptSuggestion.ts.
export const CREATE_ISSUE_MUTATION = `
  mutation IssueCreate($input: IssueCreateInput!) {
    issueCreate(input: $input) {
      success
      issue {
        id
        identifier
        title
        url
      }
    }
  }
`;

const FILE_UPLOAD_MUTATION = `
  mutation FileUpload($contentType: String!, $filename: String!, $size: Int!) {
    fileUpload(contentType: $contentType, filename: $filename, size: $size) {
      success
      uploadFile {
        uploadUrl
        assetUrl
        headers { key value }
      }
    }
  }
`;

const ATTACHMENT_CREATE_MUTATION = `
  mutation AttachmentCreate($input: AttachmentCreateInput!) {
    attachmentCreate(input: $input) {
      success
      attachment { id url title }
    }
  }
`;

// POST /issues/upload — uploads a file to Linear storage, returns its asset URL.
// Done server-side because Linear's presigned upload URLs don't allow browser CORS.
export async function handleRequestUpload(req: Request): Promise<Response> {
  const formData = await req.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return Response.json({ error: "Missing file" }, { status: 400 });
  }

  const data = await linearRequest(FILE_UPLOAD_MUTATION, {
    filename: file.name,
    contentType: file.type || "application/octet-stream",
    size: file.size,
  });
  const uploadFile = data?.fileUpload?.uploadFile;

  if (!data?.fileUpload?.success || !uploadFile) {
    return Response.json({ error: "Failed to request upload URL" }, { status: 500 });
  }

  const putHeaders: Record<string, string> = {};
  (uploadFile.headers ?? []).forEach((h: { key: string; value: string }) => {
    putHeaders[h.key] = h.value;
  });

  const putRes = await fetch(uploadFile.uploadUrl, {
    method: "PUT",
    headers: putHeaders,
    body: file,
  });

  if (!putRes.ok) {
    console.error("[handleRequestUpload] Linear storage PUT failed:", putRes.status, await putRes.text());
    return Response.json({ error: "Failed to upload file to Linear" }, { status: 500 });
  }

  return Response.json({ name: file.name, url: uploadFile.assetUrl });
}

const GET_ISSUE_ATTACHMENTS_QUERY = `
  query IssueAttachments($id: String!) {
    issue(id: $id) {
      attachments(first: 50) {
        nodes { id title url createdAt creator { displayName } }
      }
    }
  }
`;

// GET /issues/attachments?issueId= — the files (and links) attached to an
// issue, newest first. Fetched on demand by the ticket's Description tab
// rather than with every issue list.
export async function handleGetAttachments(req: Request): Promise<Response> {
  const issueId = new URL(req.url).searchParams.get("issueId");
  if (!issueId) return Response.json({ error: "Missing issueId" }, { status: 400 });

  const data = await linearRequest(GET_ISSUE_ATTACHMENTS_QUERY, { id: issueId });
  const attachments = [...(data.issue?.attachments?.nodes ?? [])].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  return Response.json(attachments);
}

// POST /issues/attachment — attaches an already-uploaded file (by its Linear assetUrl) to an issue
export async function handleCreateAttachment(req: Request): Promise<Response> {
  const { issueId, url, title } = await req.json();

  if (!issueId || !url) {
    return Response.json({ error: "Missing issueId or url" }, { status: 400 });
  }

  const data = await linearRequest(ATTACHMENT_CREATE_MUTATION, {
    input: { issueId, url, title: title ?? url },
  });

  return Response.json(data.attachmentCreate);
}

async function resolveCustomer(slug: string, schema: string): Promise<{ teamId: string; linearSlug: string | null }> {
  const { data, error } = await supabase.schema(schema)
    .from("customers")
    .select("linear_projects, linear_slug")
    .ilike("clientName", escapeIlike(slug))
    .maybeSingle();

  let teamId: string | null = null;

  if (!error && data?.linear_projects?.length) {
    const projectData = await linearRequest(GET_PROJECT_TEAM_QUERY, {
      id: data.linear_projects[0],
    });
    teamId = projectData?.project?.teams?.nodes?.[0]?.id ?? null;
  }

  if (!teamId) {
    const teamsData = await linearRequest(GET_FIRST_TEAM_QUERY);
    teamId = teamsData?.teams?.nodes?.[0]?.id ?? null;
  }

  if (!teamId) throw new Error("No teams found in Linear workspace");

  return { teamId, linearSlug: data?.linear_slug ?? null };
}


// Exported for supabase/functions/suggested-features/acceptSuggestion.ts.
export const PRIORITY_MAP: Record<string, number> = {
  urgent: 1,
  high: 2,
  medium: 3,
  low: 4,
};

const CREATE_PROJECT_MUTATION = `
  mutation CreateProject($input: ProjectCreateInput!) {
    projectCreate(input: $input) {
      success
      project { id name url }
    }
  }
`;

const GET_INITIATIVE_UUID_QUERY = `
  query GetInitiativeUUID($id: String!) {
    initiative(id: $id) {
      id
    }
  }
`;

const LINK_PROJECT_TO_INITIATIVE_MUTATION = `
  mutation InitiativeToProjectCreate($initiativeId: String!, $projectId: String!) {
    initiativeToProjectCreate(input: { initiativeId: $initiativeId, projectId: $projectId }) {
      success
      initiativeToProject { id }
    }
  }
`;

// Re-syncs customers.linear_projects with Linear's actual initiative membership
// (customers.linear_slug), instead of trusting that a just-created project got linked.
// This way a failed/partial link never leaves a stray id behind.
async function syncCustomerLinearProjects(slug: string, linearSlug: string, schema: string) {
  try {
    const initiativeData = await linearRequest(GET_INITIATIVE_PROJECTS_QUERY, { initiativeId: linearSlug });
    const projectIds: string[] = (initiativeData?.initiative?.projects?.nodes ?? []).map(
      (p: { id: string }) => p.id,
    );

    const { error } = await supabase.schema(schema)
      .from("customers")
      .update({ linear_projects: projectIds })
      .ilike("clientName", escapeIlike(slug));

    if (error) {
      console.error("[handleCreateProject] Failed to update customers.linear_projects:", error);
    }
  } catch (err) {
    console.error("[handleCreateProject] Failed to re-sync customers.linear_projects from initiative:", err);
  }
}

export async function handleCreateProject(req: Request): Promise<Response> {
  const schema = "portal";
  const { name, description, targetDate, slug } = await req.json();

  if (!name?.trim()) {
    return Response.json({ error: "Missing project name" }, { status: 400 });
  }
  if (!slug) {
    return Response.json({ error: "Missing slug" }, { status: 400 });
  }

  const { teamId, linearSlug } = await resolveCustomer(slug, schema);

  const input: Record<string, any> = {
    name: name.trim(),
    teamIds: [teamId],
  };

  if (description?.trim()) input.description = description.trim();
  if (targetDate) input.targetDate = targetDate;

  const data = await linearRequest(CREATE_PROJECT_MUTATION, { input });
  const project = data.projectCreate?.project;

  let linkError: string | null = null;
  if (project && linearSlug) {
    try {
      const initiativeData = await linearRequest(GET_INITIATIVE_UUID_QUERY, { id: linearSlug });
      const initiativeUUID = initiativeData?.initiative?.id;

      if (!initiativeUUID) throw new Error(`Initiative not found for slug: ${linearSlug}`);

      await linearRequest(LINK_PROJECT_TO_INITIATIVE_MUTATION, {
        initiativeId: initiativeUUID,
        projectId: project.id,
      });
    } catch (err) {
      linkError = String(err);
      console.error("[handleCreateProject] Failed to link project to initiative:", err);
    }
  }

  if (project && linearSlug) {
    await syncCustomerLinearProjects(slug, linearSlug, schema);
  }

  return Response.json({ ...data.projectCreate, linkError });
}

function buildIssueInput(body: Record<string, any>, teamId: string): Record<string, any> {
  const { title, description, priority, projectId, assigneeId, projectMilestoneId, estimate } = body;

  const input: Record<string, any> = {
    title: title.trim(),
    description: description ?? "",
    teamId,
    priority: PRIORITY_MAP[priority] ?? 0,
  };

  if (projectId) input.projectId = projectId;
  if (assigneeId) input.assigneeId = assigneeId;
  if (projectMilestoneId) input.projectMilestoneId = projectMilestoneId;
  if (estimate !== undefined && estimate !== null && estimate !== "") {
    input.estimate = Number(estimate);
  }

  return input;
}

// For bug/feature issues, auto-attach the team's matching "bug"/"feature" label, if one exists.
async function resolveAutoLabelId(type: string, teamId: string): Promise<string | null> {
  if (type !== "bug" && type !== "feature") return null;

  try {
    const labelsData = await linearRequest(GET_TEAM_LABELS_QUERY, { teamId });
    const matchedLabel = labelsData?.team?.labels?.nodes?.find(
      (l: { id: string; name: string }) => l.name.toLowerCase().includes(type),
    );
    return matchedLabel?.id ?? null;
  } catch (err) {
    console.error(`[handleCreateIssue] Failed to resolve ${type} label:`, err);
    return null;
  }
}

export async function handleCreateIssue(req: Request): Promise<Response> {
  const schema = "portal";
  const body = await req.json();
  const { title, slug, type, teamId: bodyTeamId, labelIds } = body;

  if (!title?.trim()) {
    return Response.json({ error: "Missing title" }, { status: 400 });
  }

  let teamId = bodyTeamId;
  // Vector namespace must be linear_slug (stable, same as linear-vector-sync),
  // not the route `slug` (editable, inconsistently cased).
  let linearSlug: string | null = null;
  if (slug) {
    const resolved = await resolveCustomer(slug, schema);
    linearSlug = resolved.linearSlug;
    if (!teamId) teamId = resolved.teamId;
  } else if (!teamId) {
    return Response.json(
      { error: "Missing teamId or slug" },
      { status: 400 },
    );
  }

  const input = buildIssueInput(body, teamId);

  const resolvedLabelIds: string[] = labelIds ? [...labelIds] : [];
  const autoLabelId = await resolveAutoLabelId(type, teamId);
  if (autoLabelId) resolvedLabelIds.push(autoLabelId);
  if (resolvedLabelIds.length) input.labelIds = resolvedLabelIds;

  const data = await linearRequest(CREATE_ISSUE_MUTATION, { input });
  const createdIssue = data.issueCreate?.issue;

  // Best-effort: makes the new ticket searchable right away.
  if (linearSlug && createdIssue) {
    await upsertIssueVector(linearSlug, {
      id: createdIssue.id,
      title: input.title,
      description: input.description,
      kind: type === "bug" || type === "feature" ? type : null,
    });
  }

  return Response.json(data.issueCreate);
}
