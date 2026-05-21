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

  const res = await fetch(`${supabaseUrl}/rest/v1/decisions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      Prefer: "return=representation",
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
  const { issueId, decisionId, question, questionEmail, decisionBody, decisionEmail } = await req.json();

  if (!issueId || !decisionId || !question || !decisionBody) {
    return Response.json(
      { error: "Missing issueId, decisionId, question, or decisionBody" },
      { status: 400 },
    );
  }

  const supabaseUrl = Deno.env.get("PROJECT_URL")!;
  const serviceKey = Deno.env.get("SERVICE_SECRET_KEY")!;

  // Look up the CometChat group and stored first message for this issue
  const chatRes = await fetch(
    `${supabaseUrl}/rest/v1/issue_chats?issue_id=eq.${issueId}&select=cometchat_group_id,first_message_text&limit=1`,
    { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } },
  );
  const chatRowRaw = await chatRes.json();
  const [chatRow] = chatRowRaw;
  const cometchatGroupId: string | null = chatRow?.cometchat_group_id ?? null;
  const firstMessageText: string | null = chatRow?.first_message_text ?? null;

  let effectiveQuestion = question;
  if (firstMessageText) {
    effectiveQuestion = firstMessageText;
    await fetch(`${supabaseUrl}/rest/v1/decisions?id=eq.${decisionId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ question: effectiveQuestion }),
    });
  }

  const quotedQuestion = effectiveQuestion.split("\n").map((l: string) => `> ${l}`).join("\n");
  const quotedDecision = decisionBody.split("\n").map((l: string) => `> ${l}`).join("\n");
  const chatLine = cometchatGroupId ? `\n\n---\n💬 Chat Group: \`${cometchatGroupId}\`` : "";
  const body = `**Question** _(${questionEmail})_:\n${quotedQuestion}\n\n**Decision** _(${decisionEmail})_:\n${quotedDecision}${chatLine}`;

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

  const decisionObj = {
    body: decision,
    email: decisionEmail,
    created_at: new Date().toISOString(),
  };

  const res = await fetch(
    `${supabaseUrl}/rest/v1/decisions?id=eq.${decisionId}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        Prefer: "return=representation",
      },
      body: JSON.stringify({ decisions: decisionObj }),
    },
  );

  const updated = await res.json();

  if (!res.ok) {
    return Response.json({ error: "Failed to set decision", details: updated }, { status: 500 });
  }

  return Response.json(updated[0] ?? updated);
}

export async function handleAddAnswer(req: Request): Promise<Response> {
  const { decisionId, answer, answererEmail } = await req.json();

  if (!decisionId || !answer || !answererEmail) {
    return Response.json(
      { error: "Missing decisionId, answer, or answererEmail" },
      { status: 400 },
    );
  }

  const supabaseUrl = Deno.env.get("PROJECT_URL")!;
  const serviceKey = Deno.env.get("SERVICE_SECRET_KEY")!;

  // Fetch current answers
  const getRes = await fetch(
    `${supabaseUrl}/rest/v1/decisions?id=eq.${decisionId}&select=answers`,
    {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
    },
  );
  const [current] = await getRes.json();

  if (!current) {
    return Response.json({ error: "Decision not found" }, { status: 404 });
  }

  const newAnswers = [
    ...(current.answers ?? []),
    { email: answererEmail, body: answer, created_at: new Date().toISOString() },
  ];

  const patchRes = await fetch(
    `${supabaseUrl}/rest/v1/decisions?id=eq.${decisionId}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        Prefer: "return=representation",
      },
      body: JSON.stringify({ answers: newAnswers }),
    },
  );

  const updated = await patchRes.json();

  if (!patchRes.ok) {
    return Response.json({ error: "Failed to add answer", details: updated }, { status: 500 });
  }

  return Response.json(updated[0] ?? updated);
}

// ─── Projects & Milestones ───────────────────────────────────────────────────

const GET_INITIATIVE_PROJECTS_QUERY = `
  query GetInitiativeProjects($initiativeId: String!) {
    initiative(id: $initiativeId) {
      projects(first: 50) {
        nodes { id name }
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
  const initiativeId = new URL(req.url).searchParams.get("initiativeId");
  if (!initiativeId) return Response.json({ error: "Missing initiativeId" }, { status: 400 });

  const data = await linearRequest(GET_INITIATIVE_PROJECTS_QUERY, { initiativeId });
  return Response.json(data.initiative?.projects?.nodes ?? []);
}

export async function handleGetMilestones(req: Request): Promise<Response> {
  const projectId = new URL(req.url).searchParams.get("projectId");
  if (!projectId) return Response.json({ error: "Missing projectId" }, { status: 400 });

  const data = await linearRequest(GET_MILESTONES_QUERY, { projectId });
  return Response.json(data.project?.projectMilestones?.nodes ?? []);
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
