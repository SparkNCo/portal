// @ts-nocheck
import { supabase } from "../client.ts";
import { LINEAR_GRAPHQL } from "../utils/headers.ts";

const GET_PROJECT_TEAM_QUERY = `
  query GetProjectTeam($id: String!) {
    project(id: $id) {
      teams(first: 1) { nodes { id } }
    }
  }
`;

const GET_FIRST_TEAM_QUERY = `
  query GetFirstTeam {
    teams(first: 1) { nodes { id } }
  }
`;

const GET_TEAM_LABELS_QUERY = `
  query GetTeamLabels($teamId: String!) {
    team(id: $teamId) {
      labels { nodes { id name } }
    }
  }
`;

const CREATE_ISSUE_MUTATION = `
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

async function linearRequest(query: string, variables: Record<string, any> = {}) {
  const res = await fetch(LINEAR_GRAPHQL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: Deno.env.get("LINEAR_API_KEY")!,
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json.data;
}

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

// POST /issues/upload — takes a file (multipart/form-data), uploads it to Linear's
// storage on the server side, and returns its public asset URL.
//
// Linear's presigned GCS upload URLs aren't CORS-enabled for browser-direct PUTs
// from third-party origins, so the PUT has to happen server-to-server here rather
// than from the client.
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

async function resolveCustomer(slug: string): Promise<{ teamId: string; linearSlug: string | null }> {
  const { data, error } = await supabase.schema("portal")
    .from("customers")
    .select("linear_projects, linear_slug")
    .eq("clientName", slug)
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

async function resolveTeamId(slug: string): Promise<string> {
  const { teamId } = await resolveCustomer(slug);
  return teamId;
}

const PRIORITY_MAP: Record<string, number> = {
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

export async function handleCreateProject(req: Request): Promise<Response> {
  const { name, description, targetDate, slug } = await req.json();

  if (!name?.trim()) {
    return Response.json({ error: "Missing project name" }, { status: 400 });
  }
  if (!slug) {
    return Response.json({ error: "Missing slug" }, { status: 400 });
  }

  const { teamId, linearSlug } = await resolveCustomer(slug);

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

  if (project) {
    const { data: customer } = await supabase.schema("portal")
      .from("customers")
      .select("linear_projects")
      .eq("clientName", slug)
      .maybeSingle();

    const current: string[] = customer?.linear_projects ?? [];

    const { error } = await supabase.schema("portal")
      .from("customers")
      .update({ linear_projects: [...current, project.id] })
      .eq("clientName", slug);

    if (error) {
      console.error("[handleCreateProject] Failed to update customers.linear_projects:", error);
    }
  }

  return Response.json({ ...data.projectCreate, linkError });
}

export async function handleCreateIssue(req: Request): Promise<Response> {
  const body = await req.json();
  const {
    title,
    description,
    priority,
    slug,
    type,
    teamId: bodyTeamId,
    projectId,
    assigneeId,
    labelIds,
    estimate,
  } = body;

  if (!title?.trim()) {
    return Response.json({ error: "Missing title" }, { status: 400 });
  }

  let teamId = bodyTeamId;
  if (!teamId) {
    if (!slug) {
      return Response.json(
        { error: "Missing teamId or slug" },
        { status: 400 },
      );
    }
    teamId = await resolveTeamId(slug);
  }

  const input: Record<string, any> = {
    title: title.trim(),
    description: description ?? "",
    teamId,
    priority: PRIORITY_MAP[priority] ?? 0,
  };

  if (projectId) input.projectId = projectId;
  if (assigneeId) input.assigneeId = assigneeId;
  if (body.projectMilestoneId) input.projectMilestoneId = body.projectMilestoneId;
  if (estimate !== undefined && estimate !== null && estimate !== "") {
    input.estimate = Number(estimate);
  }

  const resolvedLabelIds: string[] = labelIds ? [...labelIds] : [];

  if (type === "bug") {
    try {
      const labelsData = await linearRequest(GET_TEAM_LABELS_QUERY, { teamId });
      const bugLabel = labelsData?.team?.labels?.nodes?.find(
        (l: { id: string; name: string }) => l.name.toLowerCase().includes("bug"),
      );
      if (bugLabel) resolvedLabelIds.push(bugLabel.id);
    } catch (err) {
      console.error("[handleCreateIssue] Failed to resolve bug label:", err);
    }
  }

  if (resolvedLabelIds.length) input.labelIds = resolvedLabelIds;

  const data = await linearRequest(CREATE_ISSUE_MUTATION, { input });

  return Response.json(data.issueCreate);
}
