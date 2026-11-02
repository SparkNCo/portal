// @ts-nocheck
// Calls to one customer's Jira Cloud site (REST v3 + Agile v1), with the
// URL/email from `customers.systems.jira` and the API token from Vault.
// One session per request: the token, project and custom-field ids are
// looked up once and reused.
import { TicketError, type TicketCustomer } from "../errors.ts";
import { describeJiraNetworkError, describeJiraResponse, normalizeJiraProjectKey } from "../ticketSystem.ts";
import { getTicketToken, jiraHeaders } from "../jiraConnection.ts";
import type { JiraMapContext } from "./map.ts";

const REQUEST_TIMEOUT_MS = 20_000;

// The reasons Jira gives for a 400 (field errors and messages), joined.
function jiraReasons(body: any): string {
  const messages = [...(body?.errorMessages ?? []), ...Object.values(body?.errors ?? {})].filter(Boolean);
  return messages.join(" ");
}

function notConfigured(): never {
  throw new TicketError("This customer's Jira connection isn't set up. Add it in Admin → Users → Edit Customer.", 400);
}

function parseJson(text: string): any {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// A failed Jira response as a TicketError for the person using the portal.
// `jiraFieldErrors`: the fields Jira objected to, for callers that retry
// without them.
function responseError(status: number, json: any): TicketError {
  const reasons = jiraReasons(json);
  let error: TicketError;
  if (status === 400 && reasons) {
    error = new TicketError(`Jira refused it: ${reasons}`, 400);
  } else if (status === 404) {
    error = new TicketError("Not found in Jira (or the portal's Jira account can't see it).", 404);
  } else {
    error = new TicketError(describeJiraResponse(status, "account"), status >= 500 ? 502 : status);
  }
  error.jiraFieldErrors = Object.keys(json?.errors ?? {});
  return error;
}

// `options.token` skips the Vault lookup (local scripts only).
export function jiraSession(customer: TicketCustomer, options: { token?: string } = {}) {
  const settings = customer.systems?.jira;
  const projectKey = normalizeJiraProjectKey(customer.linear_slug);
  let token: string | null = options.token ?? null;
  let project: any = null;
  let fields: { sprintField: string | null; storyPointFields: string[]; writeStoryPointField: string | null } | null = null;
  let boardId: number | null | undefined;

  async function request(method: string, path: string, body?: unknown): Promise<any> {
    if (!settings?.base_url || !settings?.email || !projectKey) notConfigured();
    token ??= await getTicketToken(customer.customer_id);
    if (!token) notConfigured();

    let res: Response;
    try {
      res = await fetch(`${settings.base_url}${path}`, {
        method,
        headers: { ...jiraHeaders(settings, token), ...(body !== undefined && { "Content-Type": "application/json" }) },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (err) {
      throw new TicketError(describeJiraNetworkError(err, settings.base_url), 502);
    }

    if (res.status === 204) return null;
    const text = await res.text();
    const json = parseJson(text);

    if (!res.ok) {
      console.error("[jira] request failed", { method, path, status: res.status, body: text.slice(0, 500) });
      throw responseError(res.status, json);
    }
    return json;
  }

  return {
    customerId: customer.customer_id,
    projectKey: projectKey as string,
    get baseUrl(): string {
      return settings?.base_url ?? "";
    },
    request,

    // The Jira project: numeric id, style (team-managed = "next-gen"), issue types.
    async project() {
      project ??= await request("GET", `/rest/api/3/project/${encodeURIComponent(projectKey!)}`);
      return project;
    },

    // Custom field ids for sprint and story points on this site.
    async fields() {
      if (fields) return fields;
      const all: any[] = await request("GET", "/rest/api/3/field");
      const sprint = all.find((f) => f.schema?.custom === "com.pyxis.greenhopper.jira:gh-sprint");
      const pointFields = all.filter((f) => /^story point(s| estimate)$/i.test(f.name ?? ""));
      const style = (await this.project())?.style;
      // Team-managed projects use "Story point estimate", company-managed "Story Points".
      const preferred = pointFields.find((f) => (style === "next-gen" ? /estimate/i : /points$/i).test(f.name)) ?? pointFields[0];
      fields = {
        sprintField: sprint?.id ?? null,
        storyPointFields: pointFields.map((f) => f.id),
        writeStoryPointField: preferred?.id ?? null,
      };
      return fields;
    },

    async mapContext(): Promise<JiraMapContext> {
      const f = await this.fields();
      return { customerId: customer.customer_id, baseUrl: settings?.base_url ?? "", sprintField: f.sprintField, storyPointFields: f.storyPointFields };
    },

    // The project's board (for sprints); null when it has none.
    async boardId(): Promise<number | null> {
      if (boardId !== undefined) return boardId;
      const boards = await request("GET", `/rest/agile/1.0/board?projectKeyOrId=${encodeURIComponent(projectKey!)}`);
      const list = boards?.values ?? [];
      boardId = (list.find((b: any) => b.type === "scrum") ?? list.find((b: any) => b.type === "simple") ?? list[0])?.id ?? null;
      return boardId;
    },

    // Every field mapIssue reads, including this site's sprint/points fields.
    async issueFields(): Promise<string[]> {
      const f = await this.fields();
      return [...ISSUE_FIELDS, ...(f.sprintField ? [f.sprintField] : []), ...f.storyPointFields];
    },

    // One page of a JQL search. `nextPageToken` continues a previous page.
    async searchPage(jql: string, fieldList: string[], maxResults: number, nextPageToken?: string | null) {
      const page = await request("POST", "/rest/api/3/search/jql", {
        jql,
        fields: fieldList,
        maxResults,
        ...(nextPageToken && { nextPageToken }),
      });
      return { issues: page?.issues ?? [], nextPageToken: page?.nextPageToken ?? null };
    },

    // Every match of a JQL search, up to `max`.
    async searchAll(jql: string, fieldList: string[], max = 300): Promise<any[]> {
      const issues: any[] = [];
      let token: string | null = null;
      do {
        const page = await this.searchPage(jql, fieldList, 100, token);
        issues.push(...page.issues);
        token = page.nextPageToken;
      } while (token && issues.length < max);
      return issues.slice(0, max);
    },

    // The project's issue type for a kind of ticket.
    async issueTypeFor(kind: "bug" | "feature" | "task" | "epic") {
      const types: any[] = ((await this.project())?.issueTypes ?? []).filter((t: any) => !t.subtask);
      const byName = (re: RegExp) => types.find((t) => re.test(t.name ?? ""));
      if (kind === "epic") return types.find((t) => t.hierarchyLevel === 1) ?? byName(/^epic$/i);
      const standard = types.filter((t) => (t.hierarchyLevel ?? 0) === 0);
      if (kind === "bug") return byName(/^bug$/i) ?? byName(/^task$/i) ?? standard[0];
      if (kind === "feature") return byName(/^(story|feature|new feature)$/i) ?? byName(/^task$/i) ?? standard[0];
      return byName(/^task$/i) ?? standard[0];
    },
  };
}

// The fields of an issue the portal shows (see map.ts).
const ISSUE_FIELDS = [
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
  "fixVersions",
];

export type JiraSession = ReturnType<typeof jiraSession>;
