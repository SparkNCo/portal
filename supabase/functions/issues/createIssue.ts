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
    teamId: bodyTeamId,
    projectId,
    assigneeId,
    labelIds,
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
  if (labelIds?.length) input.labelIds = labelIds;
  if (body.projectMilestoneId) input.projectMilestoneId = body.projectMilestoneId;

  const data = await linearRequest(CREATE_ISSUE_MUTATION, { input });

  return Response.json(data.issueCreate);
}
