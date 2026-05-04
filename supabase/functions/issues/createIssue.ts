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

async function resolveTeamId(slug: string): Promise<string> {
  const { data, error } = await supabase
    .from("users")
    .select("linear_projects")
    .eq("clientName", slug)
    .maybeSingle();

  if (!error && data?.linear_projects?.length) {
    const projectData = await linearRequest(GET_PROJECT_TEAM_QUERY, {
      id: data.linear_projects[0],
    });
    const teamId = projectData?.project?.teams?.nodes?.[0]?.id;
    if (teamId) return teamId;
  }

  // fallback: first team in the workspace
  const teamsData = await linearRequest(GET_FIRST_TEAM_QUERY);
  const teamId = teamsData?.teams?.nodes?.[0]?.id;
  if (!teamId) throw new Error("No teams found in Linear workspace");
  return teamId;
}

const PRIORITY_MAP: Record<string, number> = {
  urgent: 1,
  high: 2,
  medium: 3,
  low: 4,
};

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

  const data = await linearRequest(CREATE_ISSUE_MUTATION, { input });

  return Response.json(data.issueCreate);
}
