// @ts-nocheck
// Linear's GraphQL API, with the portal's own workspace key (LINEAR_API_KEY).
// Only the Linear adapter (and code not moved behind the wrapper yet) calls
// this directly; everything else goes through lib/tickets/provider.ts.

export const LINEAR_GRAPHQL = "https://api.linear.app/graphql";

export async function linearRequest(query: string, variables: Record<string, any> = {}) {
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

export const GET_PROJECT_TEAM_QUERY = `
  query GetProjectTeam($id: String!) {
    project(id: $id) {
      teams(first: 1) { nodes { id } }
    }
  }
`;

export const GET_TEAM_LABELS_QUERY = `
  query GetTeamLabels($teamId: String!) {
    team(id: $teamId) {
      labels {
        nodes { id name color }
      }
    }
  }
`;

export const GET_INITIATIVE_PROJECTS_QUERY = `
  query GetInitiativeProjects($initiativeId: String!) {
    initiative(id: $initiativeId) {
      projects(first: 50) {
        nodes { id name status { type } }
      }
    }
  }
`;

// Also used by suggested-features/acceptSuggestion.ts.
export const GET_STATE_ID_QUERY = `
  query GetStateId($teamId: ID!, $stateName: String!) {
    workflowStates(filter: {
      team: { id: { eq: $teamId } },
      name: { eq: $stateName }
    }) {
      nodes { id name }
    }
  }
`;

// Also used by suggested-features/updateSuggestionProject.ts.
export const GET_PROJECTS_BY_IDS_QUERY = `
  query GetProjectsByIds($filter: ProjectFilter) {
    projects(filter: $filter, first: 50) {
      nodes { id name status { type } }
    }
  }
`;

// Also used by suggested-features/updateSuggestionMilestone.ts.
export const GET_MILESTONES_QUERY = `
  query GetMilestones($projectId: String!) {
    project(id: $projectId) {
      projectMilestones(first: 50) {
        nodes { id name targetDate }
      }
    }
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

// Exported for supabase/functions/suggested-features/acceptSuggestion.ts.
export const PRIORITY_MAP: Record<string, number> = {
  urgent: 1,
  high: 2,
  medium: 3,
  low: 4,
};

const CLOSED_PROJECT_STATUS_TYPES = new Set(["completed", "canceled"]);

export function isClosedProject(project: { status?: { type?: string | null } | null } | null | undefined): boolean {
  return CLOSED_PROJECT_STATUS_TYPES.has(String(project?.status?.type ?? "").toLowerCase());
}

const PROJECT_STATUS_QUERY = `
  query ProjectStatus($id: String!) {
    project(id: $id) { id name status { type name } }
  }
`;

export async function closedProjectError(projectId: string): Promise<string | null> {
  const data = await linearRequest(PROJECT_STATUS_QUERY, { id: projectId });
  const project = data?.project;
  if (!project || !isClosedProject(project)) return null;
  return `"${project.name}" is ${project.status?.name ?? "closed"} — new tickets can't be added to a completed or cancelled project.`;
}
