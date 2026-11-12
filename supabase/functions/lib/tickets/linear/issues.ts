// @ts-nocheck
// Linear adapter — tickets (issues, bugs, comments, attachments, projects,
// milestones, labels, cycles of a ticket). The code the `issues` function
// used to run inline, unchanged in behaviour; the shapes it returns are the
// portal's ticket shapes (the Jira adapter returns the same ones).
import { supabase } from "../../../client.ts";
import { TicketError, type TicketCustomer } from "../errors.ts";
import {
  CREATE_ISSUE_MUTATION,
  GET_INITIATIVE_PROJECTS_QUERY,
  GET_MILESTONES_QUERY,
  GET_PROJECT_TEAM_QUERY,
  GET_PROJECTS_BY_IDS_QUERY,
  GET_STATE_ID_QUERY,
  GET_TEAM_LABELS_QUERY,
  PRIORITY_MAP,
  closedProjectError,
  isClosedProject,
  linearRequest,
} from "./client.ts";

// ── Queries ───────────────────────────────────────────────────────────────

export const ISSUES_QUERY = `
query Issues($filter: IssueFilter) {
  issues(first: 100, filter: $filter) {
    nodes {
      state { name }
      cycle {
        id
        name
        endsAt
        startsAt
        isActive
        isPast
        isFuture
        number
      }
      title
      url
      id
      identifier
      updatedAt
      description
      activitySummary
      assignee { id email displayName }
      branchName
      createdAt
      completedAt
      canceledAt
      comments(last: 5) {
        nodes {
          id
          bodyData
          createdAt
          editedAt
          resolvedAt
          user { displayName }
        }
      }
      project { id name slugId }
      creator { displayName }
      attachments(first: 1) { nodes { id } }
      documents(last: 5) {
        nodes {
          url
          title
        }
      }
      dueDate
      estimate
      priorityLabel
      prioritySortOrder
      number
      labels(last: 4) {
        nodes { id name color }
      }
    }
  }
}
`;

const GET_ISSUE_BY_ID_QUERY = `
  query GetIssueById($id: String!) {
    issue(id: $id) {
      id
      branchName
      title
      description
      priorityLabel
      state { name }
      labels { nodes { id name color } }
      attachments(first: 1) { nodes { id } }
      project { id name }
      createdAt
    }
  }
`;

const GET_ISSUE_TEAM_QUERY = `
  query GetIssueTeam($id: String!) {
    issue(id: $id) {
      team { id }
      state { name }
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

const UPDATE_ISSUE_MUTATION = `
  mutation IssueUpdate($issueId: String!, $input: IssueUpdateInput!) {
    issueUpdate(id: $issueId, input: $input) {
      success
      issue { id title description priorityLabel labels { nodes { name } } }
    }
  }
`;

// The cycles a ticket can be put in: its team's current and upcoming ones
// (cycles belong to a team in Linear), plus which one it's in now.
const GET_ISSUE_CYCLES_QUERY = `
  query GetIssueCycles($id: String!) {
    issue(id: $id) {
      cycle { id }
      team {
        cycles(first: 20, filter: { isPast: { eq: false } }) {
          nodes { id number name startsAt endsAt isActive }
        }
      }
    }
  }
`;

const CREATE_COMMENT_MUTATION = `
  mutation CreateComment($issueId: String!, $body: String!) {
    commentCreate(input: { issueId: $issueId, body: $body }) {
      success
      comment { id }
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

const GET_FIRST_TEAM_QUERY = `
  query GetFirstTeam {
    teams(first: 1) { nodes { id } }
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

const GET_ISSUE_ATTACHMENTS_QUERY = `
  query IssueAttachments($id: String!) {
    issue(id: $id) {
      attachments(first: 50) {
        nodes { id title url createdAt creator { displayName } }
      }
    }
  }
`;

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

const EDIT_PRIORITY_MAP: Record<string, number> = {
  urgent: 1,
  high: 2,
  medium: 3,
  low: 4,
  none: 0,
};

const EXCLUDED_COMMENT_AUTHORS = new Set(["cursor", "codex"]);

// ── Helpers ───────────────────────────────────────────────────────────────

function extractText(bodyData: string): string {
  try {
    const doc = JSON.parse(bodyData);
    const texts: string[] = [];
    function walk(node: any) {
      if (node.type === "text" && typeof node.text === "string") {
        texts.push(node.text);
      }
      if (Array.isArray(node.content)) node.content.forEach(walk);
    }
    walk(doc);
    return texts.join(" ").trim();
  } catch {
    return bodyData;
  }
}

function selectableProjects(nodes: any[] | null | undefined): { id: string; name: string }[] {
  return (nodes ?? []).filter((p) => !isClosedProject(p)).map((p) => ({ id: p.id, name: p.name }));
}

// `customers.linear_projects` is otherwise a one-time snapshot taken at
// customer creation — it never updates as new projects get added to the
// Linear initiative, so panels reading from it (Business Review, UAT, Bugs)
// silently stop covering them. Returns the freshly-synced project ids, or
// `null` if the sync itself failed (callers fall back to what was stored).
export async function syncCustomerLinearProjects(customerId: string, linearSlug: string): Promise<string[] | null> {
  try {
    const initiativeData = await linearRequest(GET_INITIATIVE_PROJECTS_QUERY, { initiativeId: linearSlug });
    const projectIds: string[] = (initiativeData?.initiative?.projects?.nodes ?? []).map((p: { id: string }) => p.id);

    const { error } = await supabase.schema("portal").from("customers").update({ linear_projects: projectIds }).eq("customer_id", customerId);
    if (error) console.error("[syncCustomerLinearProjects] Failed to update customers.linear_projects:", error);

    return projectIds;
  } catch (err) {
    console.error("[syncCustomerLinearProjects] Failed to re-sync from Linear initiative:", err);
    return null;
  }
}

// Whether a Linear project is one of the customer's (their initiative's).
// Checks the stored list first; re-syncs only when it's not there, in case
// the project was added to the initiative since.
export async function isCustomerProject(customer: TicketCustomer, projectId: string): Promise<boolean> {
  if ((customer.linear_projects ?? []).includes(projectId)) return true;
  if (!customer.linear_slug) return false;
  const synced = await syncCustomerLinearProjects(customer.customer_id, customer.linear_slug);
  return !!synced?.includes(projectId);
}

async function customerTeamId(customer: TicketCustomer | null): Promise<string> {
  let teamId: string | null = null;

  if (customer?.linear_projects?.length) {
    const projectData = await linearRequest(GET_PROJECT_TEAM_QUERY, { id: customer.linear_projects[0] });
    teamId = projectData?.project?.teams?.nodes?.[0]?.id ?? null;
  }

  if (!teamId) {
    const teamsData = await linearRequest(GET_FIRST_TEAM_QUERY);
    teamId = teamsData?.teams?.nodes?.[0]?.id ?? null;
  }

  if (!teamId) throw new Error("No teams found in Linear workspace");
  return teamId;
}

// For bug/feature issues, the team's matching "bug"/"feature" label, if any.
async function autoLabelId(type: string, teamId: string): Promise<string | null> {
  if (type !== "bug" && type !== "feature") return null;
  try {
    const labelsData = await linearRequest(GET_TEAM_LABELS_QUERY, { teamId });
    const matched = labelsData?.team?.labels?.nodes?.find((l: { name: string }) => l.name.toLowerCase().includes(type));
    return matched?.id ?? null;
  } catch (err) {
    console.error(`[linear] Failed to resolve ${type} label:`, err);
    return null;
  }
}

function requireCustomer(customer: TicketCustomer | null): TicketCustomer {
  if (!customer) throw new TicketError("Missing customer", 400);
  return customer;
}

// ── Adapter ───────────────────────────────────────────────────────────────

// `customer` is null for requests that only carry a ticket/project id —
// Linear doesn't need it for those (one workspace, one key).
export function linearTickets(customer: TicketCustomer | null) {
  return {
    system: "linear" as const,

    async listIssues(statuses?: string[]) {
      const c = requireCustomer(customer);
      let projectIds: string[] = c.linear_projects ?? [];

      // Re-sync on every fetch (not just when empty) so a project added to
      // the initiative shows up; falls back to what was stored on failure.
      if (c.linear_slug) {
        const synced = await syncCustomerLinearProjects(c.customer_id, c.linear_slug);
        if (synced) projectIds = synced;
      }

      if (!projectIds.length) {
        throw new Error(
          c.linear_slug
            ? `No projects found in Linear for initiative: ${c.linear_slug}`
            : "No Linear projects configured and no linear_slug to look them up",
        );
      }

      const filter = {
        project: { id: { in: projectIds } },
        ...(statuses?.length ? { state: { name: { in: statuses } } } : {}),
      };
      const data = await linearRequest(ISSUES_QUERY, { filter });
      const nodes = data?.issues?.nodes;
      if (!Array.isArray(nodes)) throw new Error("Invalid response from Linear API");

      return nodes.map((issue: any) => ({
        ...issue,
        comments: {
          nodes: (issue.comments?.nodes ?? [])
            .filter((comment: any) => {
              const name = comment.user?.displayName?.toLowerCase();
              return name && !EXCLUDED_COMMENT_AUTHORS.has(name);
            })
            .map((comment: any) => ({
              id: comment.id,
              body: extractText(comment.bodyData),
              createdAt: comment.createdAt,
              displayName: comment.user?.displayName ?? null,
            })),
        },
      }));
    },

    async getIssue(issueId: string) {
      const data = await linearRequest(GET_ISSUE_BY_ID_QUERY, { id: issueId });
      return data?.issue ?? null;
    },

    // Returns Linear's issueUpdate payload plus the state it had before.
    async setIssueState(issueId: string, stateName: string) {
      const issueData = await linearRequest(GET_ISSUE_TEAM_QUERY, { id: issueId });
      const teamId = issueData.issue?.team?.id;
      if (!teamId) throw new TicketError("Issue team not found", 404);

      const stateData = await linearRequest(GET_STATE_ID_QUERY, { teamId, stateName });
      const stateId = stateData.workflowStates?.nodes?.[0]?.id;
      if (!stateId) throw new TicketError(`State "${stateName}" not found in team`, 404);

      const updateData = await linearRequest(UPDATE_ISSUE_STATE_MUTATION, { issueId, stateId });
      return { result: updateData.issueUpdate, previousState: issueData.issue?.state?.name ?? null };
    },

    // `fields`: title, description, priority ("urgent"…"none"), and cycleId
    // when present (null takes the ticket out of its cycle).
    async updateIssue(issueId: string, fields: Record<string, any>) {
      const input: Record<string, any> = {};
      if (fields.title !== undefined && fields.title !== null) input.title = String(fields.title).trim();
      if (fields.description !== undefined) input.description = fields.description;
      if (fields.priority !== undefined && fields.priority !== null) {
        input.priority = EDIT_PRIORITY_MAP[String(fields.priority).toLowerCase()] ?? 0;
      }
      if ("cycleId" in fields) input.cycleId = fields.cycleId ?? null;

      if (Object.keys(input).length === 0) throw new TicketError("No fields to update", 400);

      const data = await linearRequest(UPDATE_ISSUE_MUTATION, { issueId, input });
      return data.issueUpdate;
    },

    async issueCycles(issueId: string) {
      const data = await linearRequest(GET_ISSUE_CYCLES_QUERY, { id: issueId });
      const cycles = [...(data.issue?.team?.cycles?.nodes ?? [])].sort((a, b) => a.number - b.number);
      return { currentCycleId: data.issue?.cycle?.id ?? null, cycles };
    },

    async addComment(issueId: string, body: string) {
      const data = await linearRequest(CREATE_COMMENT_MUTATION, { issueId, body });
      return data.commentCreate;
    },

    // The customer's open projects (to file a ticket under).
    async listProjects() {
      const projectIds: string[] = requireCustomer(customer).linear_projects ?? [];
      if (!projectIds.length) return [];
      const data = await linearRequest(GET_PROJECTS_BY_IDS_QUERY, { filter: { id: { in: projectIds } } });
      return selectableProjects(data.projects?.nodes);
    },

    // Admin pages that pick an initiative directly (Linear only).
    async listInitiativeProjects(initiativeId: string) {
      const data = await linearRequest(GET_INITIATIVE_PROJECTS_QUERY, { initiativeId });
      return selectableProjects(data.initiative?.projects?.nodes);
    },

    async listMilestones(projectId: string) {
      const data = await linearRequest(GET_MILESTONES_QUERY, { projectId });
      return data.project?.projectMilestones?.nodes ?? [];
    },

    async createMilestone({ projectId, name, targetDate, description }: Record<string, any>) {
      const input: Record<string, any> = { projectId, name };
      if (targetDate) input.targetDate = targetDate;
      if (description) input.description = description;
      const data = await linearRequest(CREATE_MILESTONE_MUTATION, { input });
      return data.projectMilestoneCreate;
    },

    async listLabels() {
      const projectIds: string[] = requireCustomer(customer).linear_projects ?? [];
      if (!projectIds.length) return [];
      const projectData = await linearRequest(GET_PROJECT_TEAM_QUERY, { id: projectIds[0] });
      const teamId = projectData?.project?.teams?.nodes?.[0]?.id;
      if (!teamId) return [];
      const data = await linearRequest(GET_TEAM_LABELS_QUERY, { teamId });
      return data.team?.labels?.nodes ?? [];
    },

    // `body`: title, description, priority, type ("bug" | "feature" | …),
    // projectId, projectMilestoneId, assigneeId, estimate, labelIds, and
    // teamId (only when there's no customer). Returns Linear's issueCreate.
    async createIssue(body: Record<string, any>) {
      // The portal only lists a customer's tickets that sit in one of their
      // projects, so a bug or feature without one would exist in Linear but
      // never show up here. (Admin calls with only a teamId have no customer.)
      if (customer && (body.type === "bug" || body.type === "feature") && !body.projectId) {
        const kind = body.type === "bug" ? "bug" : "feature request";
        throw new TicketError(`Pick a project for this ${kind}, or it won't show up in the portal.`, 400);
      }
      // A customer can only file tickets into their own projects; without
      // this, a hand-made request could drop a ticket into another
      // customer's project.
      if (customer && body.projectId && !(await isCustomerProject(customer, body.projectId))) {
        throw new TicketError("That project doesn't belong to this customer.", 403);
      }
      if (body.projectId) {
        const closed = await closedProjectError(body.projectId);
        if (closed) throw new TicketError(closed, 400);
      }

      // A teamId sent by the caller wins; otherwise the customer's team.
      let teamId = body.teamId;
      if (!teamId) {
        if (!customer) throw new TicketError("Missing teamId or slug", 400);
        teamId = await customerTeamId(customer);
      }

      const input: Record<string, any> = {
        title: body.title.trim(),
        description: body.description ?? "",
        teamId,
        priority: PRIORITY_MAP[body.priority] ?? 0,
      };
      if (body.projectId) input.projectId = body.projectId;
      if (body.assigneeId) input.assigneeId = body.assigneeId;
      if (body.projectMilestoneId) input.projectMilestoneId = body.projectMilestoneId;
      if (body.estimate !== undefined && body.estimate !== null && body.estimate !== "") input.estimate = Number(body.estimate);

      const labelIds: string[] = body.labelIds ? [...body.labelIds] : [];
      const typeLabel = await autoLabelId(body.type, teamId);
      if (typeLabel) labelIds.push(typeLabel);
      if (labelIds.length) input.labelIds = labelIds;

      const data = await linearRequest(CREATE_ISSUE_MUTATION, { input });
      return data.issueCreate;
    },

    // Creates a project in the customer's team and links it to their
    // initiative. `linkError` says why the link failed (the project exists).
    async createProject({ name, description, targetDate }: Record<string, any>) {
      const c = requireCustomer(customer);
      const teamId = await customerTeamId(c);

      const input: Record<string, any> = { name: name.trim(), teamIds: [teamId] };
      if (description?.trim()) input.description = description.trim();
      if (targetDate) input.targetDate = targetDate;

      const data = await linearRequest(CREATE_PROJECT_MUTATION, { input });
      const project = data.projectCreate?.project;

      let linkError: string | null = null;
      if (project && c.linear_slug) {
        try {
          const initiativeData = await linearRequest(GET_INITIATIVE_UUID_QUERY, { id: c.linear_slug });
          const initiativeUUID = initiativeData?.initiative?.id;
          if (!initiativeUUID) throw new Error(`Initiative not found for slug: ${c.linear_slug}`);
          await linearRequest(LINK_PROJECT_TO_INITIATIVE_MUTATION, { initiativeId: initiativeUUID, projectId: project.id });
        } catch (err) {
          linkError = String(err);
          console.error("[linear createProject] Failed to link project to initiative:", err);
        }
        // Re-read the initiative rather than trusting the link worked.
        await syncCustomerLinearProjects(c.customer_id, c.linear_slug);
      }

      return { ...data.projectCreate, linkError };
    },

    // Uploads a file to Linear storage and returns its asset URL (attached
    // to a ticket afterwards with createAttachment). Server-side because
    // Linear's presigned upload URLs don't allow browser CORS.
    async uploadFile(file: File) {
      const data = await linearRequest(FILE_UPLOAD_MUTATION, {
        filename: file.name,
        contentType: file.type || "application/octet-stream",
        size: file.size,
      });
      const uploadFile = data?.fileUpload?.uploadFile;
      if (!data?.fileUpload?.success || !uploadFile) throw new TicketError("Failed to request upload URL", 500);

      const putHeaders: Record<string, string> = {};
      (uploadFile.headers ?? []).forEach((h: { key: string; value: string }) => {
        putHeaders[h.key] = h.value;
      });

      const putRes = await fetch(uploadFile.uploadUrl, { method: "PUT", headers: putHeaders, body: file });
      if (!putRes.ok) {
        console.error("[linear uploadFile] storage PUT failed:", putRes.status, await putRes.text());
        throw new TicketError("Failed to upload file to Linear", 500);
      }

      return { name: file.name, url: uploadFile.assetUrl };
    },

    // Files and links on a ticket, newest first.
    async listAttachments(issueId: string) {
      const data = await linearRequest(GET_ISSUE_ATTACHMENTS_QUERY, { id: issueId });
      return [...(data.issue?.attachments?.nodes ?? [])].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    },

    async createAttachment(issueId: string, url: string, title?: string) {
      const data = await linearRequest(ATTACHMENT_CREATE_MUTATION, { input: { issueId, url, title: title ?? url } });
      return data.attachmentCreate;
    },
  };
}

export type TicketsAdapter = ReturnType<typeof linearTickets>;
