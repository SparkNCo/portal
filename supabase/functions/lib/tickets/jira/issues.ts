// @ts-nocheck
// Jira adapter — tickets. Same operations and return shapes as the Linear
// adapter (lib/tickets/linear/issues.ts), against the customer's own Jira
// project (customers.linear_slug = project key).
//
// Not available yet for Jira (answer 501 with a clear message): uploading /
// attaching files, and Linear-only admin pickers (initiatives).
import { TicketError, type TicketCustomer } from "../errors.ts";
import { jiraId, parseTicketId } from "../ids.ts";
import type { TicketsAdapter } from "../linear/issues.ts";
import { markdownToAdf } from "./adf.ts";
import { jiraSession } from "./client.ts";
import { JIRA_PRIORITY_NAME, isEpic, mapIssue, portalLabel, sprintToCycle } from "./map.ts";
import { pickTransition, portalStateName } from "./status.ts";

const MAX_ISSUES = 300;
const BASE_FIELDS = [
  "summary",
  "status",
  "description",
  "issuetype",
  "priority",
  "labels",
  "assignee",
  "creator",
  "reporter",
  "created",
  "updated",
  "resolutiondate",
  "statuscategorychangedate",
  "duedate",
  "parent",
  "comment",
  "attachment",
];
// Labels the adapter shows from the issue type; never sent to Jira as labels.
const TYPE_LABELS = new Set(["bug", "feature"]);

function notYet(what: string): never {
  throw new TicketError(`${what} isn't available for Jira customers yet.`, 501);
}

// The Jira key / native id inside a portal id (`jira:{customer}:{native}`).
function nativeId(id: string, prefix = ""): string {
  const parsed = parseTicketId(id);
  if (parsed.system !== "jira") throw new TicketError("That id doesn't belong to this customer's Jira.", 400);
  if (prefix && !parsed.nativeId.startsWith(prefix)) throw new TicketError("Unexpected Jira id.", 400);
  return prefix ? parsed.nativeId.slice(prefix.length) : parsed.nativeId;
}

// Jira labels can't contain spaces.
function jiraLabel(name: string): string {
  return String(name).trim().replace(/\s+/g, "-");
}

// `options.token` skips the Vault lookup (local scripts only).
export function jiraTickets(customer: TicketCustomer, options: { token?: string } = {}): TicketsAdapter {
  const jira = jiraSession(customer, options);

  async function issueFields(): Promise<string[]> {
    const f = await jira.fields();
    return [...BASE_FIELDS, ...(f.sprintField ? [f.sprintField] : []), ...f.storyPointFields];
  }

  // All matching issues, newest activity first, up to MAX_ISSUES.
  async function search(jql: string, fields: string[]): Promise<any[]> {
    const issues: any[] = [];
    let nextPageToken: string | undefined;
    do {
      const page = await jira.request("POST", "/rest/api/3/search/jql", { jql, fields, maxResults: 100, ...(nextPageToken && { nextPageToken }) });
      issues.push(...(page?.issues ?? []));
      nextPageToken = page?.nextPageToken;
    } while (nextPageToken && issues.length < MAX_ISSUES);
    return issues.slice(0, MAX_ISSUES);
  }

  async function fetchIssue(key: string) {
    const fields = await issueFields();
    return await jira.request("GET", `/rest/api/3/issue/${encodeURIComponent(key)}?fields=${fields.join(",")}`);
  }

  // The project's issue type for a kind of ticket.
  async function issueTypeFor(kind: "bug" | "feature" | "task" | "epic") {
    const types: any[] = ((await jira.project())?.issueTypes ?? []).filter((t: any) => !t.subtask);
    const byName = (re: RegExp) => types.find((t) => re.test(t.name ?? ""));
    if (kind === "epic") return types.find((t) => t.hierarchyLevel === 1) ?? byName(/^epic$/i);
    const standard = types.filter((t) => (t.hierarchyLevel ?? 0) === 0);
    if (kind === "bug") return byName(/^bug$/i) ?? byName(/^task$/i) ?? standard[0];
    if (kind === "feature") return byName(/^(story|feature|new feature)$/i) ?? byName(/^task$/i) ?? standard[0];
    return byName(/^task$/i) ?? standard[0];
  }

  // Creates an issue; when Jira refuses an optional field (not on that
  // project's screen — common for priority or story points in team-managed
  // projects), tries once more without the fields it named.
  async function createWithFallback(fields: Record<string, any>, optional: string[]) {
    try {
      return await jira.request("POST", "/rest/api/3/issue", { fields });
    } catch (err) {
      const refused = (err?.jiraFieldErrors ?? []).filter((f: string) => optional.includes(f));
      if (!(err instanceof TicketError) || err.status !== 400 || refused.length === 0) throw err;
      const retry = { ...fields };
      for (const f of refused) delete retry[f];
      return await jira.request("POST", "/rest/api/3/issue", { fields: retry });
    }
  }

  return {
    system: "jira" as any,

    async listIssues(statuses?: string[]) {
      const [issues, ctx] = await Promise.all([
        search(`project = "${jira.projectKey}" ORDER BY updated DESC`, await issueFields()),
        jira.mapContext(),
      ]);
      const tickets = issues.filter((issue) => !isEpic(issue)).map((issue) => mapIssue(issue, ctx));
      // Filtered after mapping: the names asked for are portal states.
      return statuses?.length ? tickets.filter((t) => statuses.includes(t.state.name)) : tickets;
    },

    async getIssue(issueId: string) {
      const [issue, ctx] = await Promise.all([fetchIssue(nativeId(issueId)), jira.mapContext()]);
      return issue ? mapIssue(issue, ctx) : null;
    },

    async setIssueState(issueId: string, stateName: string) {
      const key = nativeId(issueId);
      const current = await jira.request("GET", `/rest/api/3/issue/${encodeURIComponent(key)}?fields=status`);
      const previousState = portalStateName(current?.fields?.status);

      if (previousState !== stateName) {
        const { transitions } = await jira.request("GET", `/rest/api/3/issue/${encodeURIComponent(key)}/transitions`);
        const transition = pickTransition(transitions ?? [], stateName);
        if (!transition) {
          throw new TicketError(`This ticket's Jira workflow has no step to "${stateName}" from "${current?.fields?.status?.name}".`, 400);
        }
        await jira.request("POST", `/rest/api/3/issue/${encodeURIComponent(key)}/transitions`, { transition: { id: transition.id } });
      }

      return { result: { success: true, issue: { id: issueId, state: { name: stateName } } }, previousState };
    },

    async updateIssue(issueId: string, input: Record<string, any>) {
      const key = nativeId(issueId);
      const fields: Record<string, any> = {};
      if (input.title !== undefined && input.title !== null) fields.summary = String(input.title).trim();
      if (input.description !== undefined) fields.description = markdownToAdf(input.description);
      if (input.priority !== undefined && input.priority !== null) {
        const name = JIRA_PRIORITY_NAME[String(input.priority).toLowerCase()];
        if (name) fields.priority = { name };
      }
      const movesSprint = "cycleId" in input;

      if (Object.keys(fields).length === 0 && !movesSprint) throw new TicketError("No fields to update", 400);

      if (Object.keys(fields).length) await jira.request("PUT", `/rest/api/3/issue/${encodeURIComponent(key)}`, { fields });
      if (movesSprint) {
        if (input.cycleId) {
          await jira.request("POST", `/rest/agile/1.0/sprint/${nativeId(input.cycleId, "sprint:")}/issue`, { issues: [key] });
        } else {
          await jira.request("POST", "/rest/agile/1.0/backlog/issue", { issues: [key] });
        }
      }

      const issue = await this.getIssue(issueId);
      return {
        success: true,
        issue: issue && { id: issue.id, title: issue.title, description: issue.description, priorityLabel: issue.priorityLabel, labels: issue.labels },
      };
    },

    // The sprints a ticket can go in (active and upcoming), and its current one.
    async issueCycles(issueId: string) {
      const key = nativeId(issueId);
      const board = await jira.boardId();
      if (!board) return { currentCycleId: null, cycles: [] };

      const { sprintField } = await jira.fields();
      const [sprints, issue] = await Promise.all([
        jira.request("GET", `/rest/agile/1.0/board/${board}/sprint?state=active,future&maxResults=50`).catch(() => ({ values: [] })),
        sprintField ? jira.request("GET", `/rest/api/3/issue/${encodeURIComponent(key)}?fields=${sprintField}`) : null,
      ]);

      const cycles = (sprints?.values ?? [])
        .map((s: any) => ({
          id: jiraId(jira.customerId, `sprint:${s.id}`),
          number: s.id,
          name: s.name,
          startsAt: s.startDate ?? null,
          endsAt: s.endDate ?? null,
          isActive: s.state === "active",
        }))
        .sort((a: any, b: any) => a.number - b.number);
      const current = sprintField ? sprintToCycle(issue?.fields?.[sprintField], jira.customerId) : null;
      return { currentCycleId: current && !current.isPast ? current.id : null, cycles };
    },

    async addComment(issueId: string, body: string) {
      const comment = await jira.request("POST", `/rest/api/3/issue/${encodeURIComponent(nativeId(issueId))}/comment`, { body: markdownToAdf(body) });
      return { success: true, comment: { id: String(comment?.id ?? "") } };
    },

    // Open epics: what a ticket can be filed under.
    async listProjects() {
      const epicType = await issueTypeFor("epic");
      if (!epicType) return [];
      const epics = await search(`project = "${jira.projectKey}" AND issuetype = ${epicType.id} AND statusCategory != Done ORDER BY created ASC`, ["summary"]);
      return epics.map((e) => ({ id: jiraId(jira.customerId, e.key), name: e.fields?.summary ?? e.key }));
    },

    listInitiativeProjects: async () => notYet("Initiatives"),

    // Unreleased versions of the project (Jira versions belong to the
    // project, not to an epic, so every epic offers the same ones).
    async listMilestones(_projectId: string) {
      const versions = await jira.request("GET", `/rest/api/3/project/${encodeURIComponent(jira.projectKey)}/versions`);
      return (versions ?? [])
        .filter((v: any) => !v.released && !v.archived)
        .map((v: any) => ({ id: jiraId(jira.customerId, `version:${v.id}`), name: v.name, targetDate: v.releaseDate ?? null }));
    },

    async createMilestone({ name, targetDate, description }: Record<string, any>) {
      const project = await jira.project();
      const version = await jira.request("POST", "/rest/api/3/version", {
        name,
        projectId: Number(project.id),
        ...(targetDate && { releaseDate: targetDate }),
        ...(description && { description }),
      });
      return { success: true, projectMilestone: { id: jiraId(jira.customerId, `version:${version.id}`), name: version.name } };
    },

    async listLabels() {
      const labels = await jira.request("GET", "/rest/api/3/label?maxResults=1000");
      return (labels?.values ?? []).map(portalLabel);
    },

    async createIssue(body: Record<string, any>) {
      const kind = body.type === "bug" ? "bug" : body.type === "feature" ? "feature" : "task";
      const issueType = await issueTypeFor(kind);
      if (!issueType) throw new TicketError(`The Jira project ${jira.projectKey} has no issue type to create this ticket with.`, 400);

      const { writeStoryPointField } = await jira.fields();
      const priority = JIRA_PRIORITY_NAME[String(body.priority ?? "").toLowerCase()];
      const labels = (body.labelIds ?? []).filter((l: string) => !TYPE_LABELS.has(String(l).toLowerCase())).map(jiraLabel);
      const hasEstimate = body.estimate !== undefined && body.estimate !== null && body.estimate !== "";

      const fields: Record<string, any> = {
        project: { key: jira.projectKey },
        summary: body.title.trim(),
        description: markdownToAdf(body.description ?? ""),
        issuetype: { id: issueType.id },
        ...(priority && { priority: { name: priority } }),
        ...(body.projectId && { parent: { key: nativeId(body.projectId) } }),
        ...(body.projectMilestoneId && { fixVersions: [{ id: nativeId(body.projectMilestoneId, "version:") }] }),
        ...(labels.length && { labels }),
        ...(hasEstimate && writeStoryPointField && { [writeStoryPointField]: Number(body.estimate) }),
      };

      const created = await createWithFallback(fields, ["priority", "labels", "fixVersions", ...(writeStoryPointField ? [writeStoryPointField] : [])]);
      return {
        success: true,
        issue: { id: jiraId(jira.customerId, created.key), identifier: created.key, title: fields.summary, url: `${jira.baseUrl}/browse/${created.key}` },
      };
    },

    // A Linear project is an Epic in Jira.
    async createProject({ name, description, targetDate }: Record<string, any>) {
      const epicType = await issueTypeFor("epic");
      if (!epicType) throw new TicketError(`The Jira project ${jira.projectKey} has no Epic issue type.`, 400);

      const created = await createWithFallback(
        {
          project: { key: jira.projectKey },
          summary: name.trim(),
          issuetype: { id: epicType.id },
          ...(description?.trim() && { description: markdownToAdf(description.trim()) }),
          ...(targetDate && { duedate: targetDate }),
        },
        ["duedate"],
      );
      return {
        success: true,
        project: { id: jiraId(jira.customerId, created.key), name: name.trim(), url: `${jira.baseUrl}/browse/${created.key}` },
        linkError: null,
      };
    },

    uploadFile: async () => notYet("Uploading files"),
    createAttachment: async () => notYet("Attaching files"),

    // Files on a ticket, newest first. Their links open in Jira (viewing
    // them needs a Jira login until the image proxy supports Jira).
    async listAttachments(issueId: string) {
      const issue = await jira.request("GET", `/rest/api/3/issue/${encodeURIComponent(nativeId(issueId))}?fields=attachment`);
      return (issue?.fields?.attachment ?? [])
        .map((a: any) => ({
          id: jiraId(jira.customerId, `attachment:${a.id}`),
          title: a.filename,
          url: a.content,
          createdAt: a.created,
          creator: { displayName: a.author?.displayName ?? null },
        }))
        .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    },
  };
}
