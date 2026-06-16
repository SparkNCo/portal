// @ts-nocheck
import { LINEAR_GRAPHQL } from "../utils/headers.ts";

const GET_ISSUE_TEAM_QUERY = `
  query GetIssueTeam($id: String!) {
    issue(id: $id) {
      team { id }
    }
  }
`;

const GET_STATE_ID_QUERY = `
  query GetStateId($teamId: ID!, $stateName: String!) {
    workflowStates(filter: {
      team: { id: { eq: $teamId } },
      name: { eq: $stateName }
    }) {
      nodes { id name }
    }
  }
`;

const UPDATE_ISSUE_STATE_MUTATION = `
  mutation UpdateIssueState($issueId: String!, $stateId: String!) {
    issueUpdate(id: $issueId, input: { stateId: $stateId }) {
      success
      issue { id state { name } }
    }
  }
`;

async function linearRequest(query: string, variables: Record<string, string>) {
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

export async function handleUpdateState(req: Request): Promise<Response> {
  try {
    const body = await req.json();
    console.log("📥 Incoming body:", body);

    const { issueId, stateName } = body;

    if (!issueId || !stateName) {
      console.log("❌ Missing params:", { issueId, stateName });
      return Response.json(
        { error: "Missing issueId or stateName" },
        { status: 400 },
      );
    }

    // 1. Get issue → team
    console.log("🔎 Fetching issue team with issueId:", issueId);

    const issueData = await linearRequest(GET_ISSUE_TEAM_QUERY, {
      id: issueId,
    });
    console.log("📦 issueData:", JSON.stringify(issueData, null, 2));

    const teamId = issueData.issue?.team?.id;
    console.log("🏷️ Extracted teamId:", teamId);

    if (!teamId) {
      console.log("❌ No teamId found for issue");
      return Response.json({ error: "Issue team not found" }, { status: 404 });
    }

    // 2. Get states
    console.log("🔎 Fetching states with:", { teamId, stateName });

    const stateData = await linearRequest(GET_STATE_ID_QUERY, {
      teamId,
      stateName,
    });

    console.log("📦 stateData:", JSON.stringify(stateData, null, 2));

    const states = stateData.workflowStates?.nodes;
    console.log("📋 Available states:", states);

    const stateId = states?.[0]?.id;
    console.log("🎯 Selected stateId:", stateId);

    if (!stateId) {
      console.log("❌ State not found for name:", stateName);
      return Response.json(
        { error: `State "${stateName}" not found in team` },
        { status: 404 },
      );
    }

    // 3. Update issue
    console.log("🚀 Updating issue state with:", { issueId, stateId });

    const updateData = await linearRequest(UPDATE_ISSUE_STATE_MUTATION, {
      issueId,
      stateId,
    });

    console.log("✅ Update response:", JSON.stringify(updateData, null, 2));

    return Response.json(updateData.issueUpdate);
  } catch (err) {
    console.error("💥 handleUpdateState error:", err);
    return Response.json(
      { error: "Internal server error", details: String(err) },
      { status: 500 },
    );
  }
}

export async function handleAddComment(req: Request): Promise<Response> {
  const { issueId, question, ownerEmail } = await req.json();

  if (!issueId || !question || !ownerEmail) {
    return Response.json(
      { error: "Missing issueId, question, or ownerEmail" },
      { status: 400 },
    );
  }

  const supabaseUrl = Deno.env.get("PROJECT_URL")!;
  const serviceKey = Deno.env.get("SERVICE_SECRET_KEY")!;

  // Save to Supabase
  const res = await fetch(`${supabaseUrl}/rest/v1/decisions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      Prefer: "return=representation",
      "Content-Profile": "portal",
    },
    body: JSON.stringify({ issue_id: issueId, owner_email: ownerEmail, question }),
  });

  const data = await res.json();

  if (!res.ok) {
    return Response.json({ error: "Failed to create decision", details: data }, { status: 500 });
  }

  return Response.json(data[0] ?? data);
}

const CREATE_COMMENT_MUTATION = `
  mutation CreateComment($issueId: String!, $body: String!) {
    commentCreate(input: { issueId: $issueId, body: $body }) {
      success
      comment { id }
    }
  }
`;

export async function handlePostToLinear(req: Request): Promise<Response> {
  const { issueId, decisionId, decisionBody, decisionEmail } = await req.json();

  if (!issueId || !decisionId || !decisionBody) {
    return Response.json(
      { error: "Missing issueId, decisionId, or decisionBody" },
      { status: 400 },
    );
  }

  const supabaseUrl = Deno.env.get("PROJECT_URL")!;
  const serviceKey = Deno.env.get("SERVICE_SECRET_KEY")!;

  const body = `${decisionBody}\n\n— ${decisionEmail}`;

  const res = await fetch(LINEAR_GRAPHQL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: Deno.env.get("LINEAR_API_KEY")!,
    },
    body: JSON.stringify({
      query: CREATE_COMMENT_MUTATION,
      variables: { issueId, body },
    }),
  });

  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));

  await fetch(`${supabaseUrl}/rest/v1/decisions?id=eq.${decisionId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Profile": "portal",
    },
    body: JSON.stringify({ posted_to_linear: true }),
  });

  return Response.json(json.data.commentCreate);
}

export async function handleSetDecision(req: Request): Promise<Response> {
  const { decisionId, decision, decisionEmail } = await req.json();

  if (!decisionId || !decision || !decisionEmail) {
    return Response.json(
      { error: "Missing decisionId, decision, or decisionEmail" },
      { status: 400 },
    );
  }

  const supabaseUrl = Deno.env.get("PROJECT_URL")!;
  const serviceKey = Deno.env.get("SERVICE_SECRET_KEY")!;

  // Save answer, mark as closed and posted
  const res = await fetch(
    `${supabaseUrl}/rest/v1/decisions?id=eq.${decisionId}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        Prefer: "return=representation",
        "Content-Profile": "portal",
      },
      body: JSON.stringify({
        decision,
        decision_by: decisionEmail,
        decided_at: new Date().toISOString(),
        status: true,
        posted_to_linear: true,
      }),
    },
  );

  const updated = await res.json();
  if (!res.ok) {
    return Response.json({ error: "Failed to set decision", details: updated }, { status: 500 });
  }

  const row = updated[0] ?? updated;

  // Fetch question + owner so we can post both together (non-fatal if Linear fails)
  try {
    const getRes = await fetch(
      `${supabaseUrl}/rest/v1/decisions?id=eq.${decisionId}&select=question,owner_email`,
      {
        headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Accept-Profile": "portal" },
      },
    );
    const [decisionRow] = await getRes.json();

    const question = decisionRow?.question ?? "";
    const ownerEmail = decisionRow?.owner_email ?? "";

    const commentBody =
      `❓ **Question** from ${ownerEmail}:\n\n${question}\n\n` +
      `✅ **Decision** from ${decisionEmail}:\n\n${decision}`;

    await fetch(LINEAR_GRAPHQL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: Deno.env.get("LINEAR_API_KEY")! },
      body: JSON.stringify({
        query: CREATE_COMMENT_MUTATION,
        variables: { issueId: row.issue_id, body: commentBody },
      }),
    });
  } catch (err) {
    console.error("[handleSetDecision] Linear sync error (non-fatal):", err);
  }

  return Response.json(row);
}

// ─── Projects & Milestones ───────────────────────────────────────────────────

const GET_PROJECT_TEAM_QUERY = `
  query GetProjectTeam($id: String!) {
    project(id: $id) {
      teams(first: 1) { nodes { id } }
    }
  }
`;

const GET_INITIATIVE_PROJECTS_QUERY = `
  query GetInitiativeProjects($initiativeId: String!) {
    initiative(id: $initiativeId) {
      projects(first: 50) {
        nodes { id name }
      }
    }
  }
`;

const GET_PROJECTS_BY_IDS_QUERY = `
  query GetProjectsByIds($filter: ProjectFilter) {
    projects(filter: $filter, first: 50) {
      nodes { id name }
    }
  }
`;

const GET_TEAM_LABELS_QUERY = `
  query GetTeamLabels($teamId: String!) {
    team(id: $teamId) {
      labels {
        nodes { id name color }
      }
    }
  }
`;

const GET_MILESTONES_QUERY = `
  query GetMilestones($projectId: String!) {
    project(id: $projectId) {
      projectMilestones(first: 50) {
        nodes { id name targetDate }
      }
    }
  }
`;

const CREATE_MILESTONE_MUTATION = `
  mutation CreateMilestone($input: ProjectMilestoneCreateInput!) {
    projectMilestoneCreate(input: $input) {
      success
      projectMilestone { id name }
    }
  }
`;

export async function handleGetProjects(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const slug = url.searchParams.get("slug");
  const initiativeId = url.searchParams.get("initiativeId");

  if (slug) {
    const supabaseUrl = Deno.env.get("PROJECT_URL")!;
    const serviceKey = Deno.env.get("SERVICE_SECRET_KEY")!;

    const res = await fetch(
      `${supabaseUrl}/rest/v1/customers?clientName=eq.${slug}&select=linear_projects`,
      {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          "Accept-Profile": "portal",
        },
      },
    );
    const [customer] = await res.json();
    const projectIds: string[] = customer?.linear_projects ?? [];

    if (!projectIds.length) return Response.json([]);

    const data = await linearRequest(GET_PROJECTS_BY_IDS_QUERY, {
      filter: { id: { in: projectIds } },
    });
    return Response.json(data.projects?.nodes ?? []);
  }

  if (!initiativeId) return Response.json({ error: "Missing slug or initiativeId" }, { status: 400 });

  const data = await linearRequest(GET_INITIATIVE_PROJECTS_QUERY, { initiativeId });
  return Response.json(data.initiative?.projects?.nodes ?? []);
}

export async function handleGetMilestones(req: Request): Promise<Response> {
  const projectId = new URL(req.url).searchParams.get("projectId");
  if (!projectId) return Response.json({ error: "Missing projectId" }, { status: 400 });

  const data = await linearRequest(GET_MILESTONES_QUERY, { projectId });
  return Response.json(data.project?.projectMilestones?.nodes ?? []);
}

export async function handleGetLabels(req: Request): Promise<Response> {
  const slug = new URL(req.url).searchParams.get("slug");
  if (!slug) return Response.json({ error: "Missing slug" }, { status: 400 });

  const supabaseUrl = Deno.env.get("PROJECT_URL")!;
  const serviceKey = Deno.env.get("SERVICE_SECRET_KEY")!;

  const res = await fetch(
    `${supabaseUrl}/rest/v1/customers?clientName=eq.${slug}&select=linear_projects`,
    {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Accept-Profile": "portal",
      },
    },
  );
  const [customer] = await res.json();
  const projectIds: string[] = customer?.linear_projects ?? [];
  if (!projectIds.length) return Response.json([]);

  const projectData = await linearRequest(GET_PROJECT_TEAM_QUERY, { id: projectIds[0] });
  const teamId = projectData?.project?.teams?.nodes?.[0]?.id;
  if (!teamId) return Response.json([]);

  const data = await linearRequest(GET_TEAM_LABELS_QUERY, { teamId });
  return Response.json(data.team?.labels?.nodes ?? []);
}

export async function handleCreateMilestone(req: Request): Promise<Response> {
  const { projectId, name, targetDate, description } = await req.json();
  if (!projectId || !name) return Response.json({ error: "Missing projectId or name" }, { status: 400 });

  const input: Record<string, any> = { projectId, name };
  if (targetDate) input.targetDate = targetDate;
  if (description) input.description = description;

  const data = await linearRequest(CREATE_MILESTONE_MUTATION, { input });
  return Response.json(data.projectMilestoneCreate);
}
