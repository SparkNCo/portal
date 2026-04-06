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

const CREATE_COMMENT_MUTATION = `
  mutation CreateComment($issueId: String!, $body: String!) {
    commentCreate(input: { issueId: $issueId, body: $body }) {
      success
      comment {
        id
        body
        createdAt
        user { displayName }
      }
    }
  }
`;

export async function handleAddComment(req: Request): Promise<Response> {
  const { issueId, body } = await req.json();

  if (!issueId || !body) {
    return Response.json({ error: "Missing issueId or body" }, { status: 400 });
  }

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

  if (json.errors) {
    throw new Error(JSON.stringify(json.errors));
  }

  return Response.json(json.data.commentCreate);
}
