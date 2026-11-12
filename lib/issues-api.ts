import { API_JSON_HEADERS as API_HEADERS, API_HEADERS as API_AUTH_HEADERS } from "@/lib/api-headers";

// Uploads a file to Linear's storage through our backend (Linear's presigned
// URLs aren't CORS-enabled for the browser) and returns its asset URL — usable
// as a markdown image in a ticket's description.
export async function uploadIssueFile(file: File): Promise<{ name: string; url: string }> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/issues/upload`, {
    method: "POST",
    // No Content-Type — the browser sets the multipart boundary itself.
    headers: API_AUTH_HEADERS,
    body: formData,
  });
  if (!res.ok) throw new Error(`Failed to upload ${file.name}`);
  const { name, url } = await res.json();
  return { name, url };
}

export interface CreateIssuePayload {
  title: string;
  description: string;
  priority: string;
  slug: string;
  type?: string;
  projectId?: string;
  projectMilestoneId?: string;
  estimate?: number;
  labelIds?: string[];
  /** Email of the portal user asking for the ticket (shown as "Requested by"). */
  requestedBy?: string;
}

// Linear tickets only show up in the portal when they belong to one of the
// customer's projects, so a Linear bug must pick one. Jira lists every ticket
// in the project (its "projects" here are epics), so there it stays optional.
export function isProjectRequired(projects: { id: string }[]): boolean {
  return !projects.some((p) => p.id.startsWith("jira:"));
}

// The last project a ticket was filed under, remembered in this browser for a
// few hours so filing several tickets in a row doesn't mean picking it every
// time. Keyed by customer and user. It's only a preselection: it's used only
// when the project is still in the list the server returns.
const LAST_PROJECT_TTL_MS = 8 * 60 * 60 * 1000;
const lastProjectKey = (slug: string, userId?: string | null) => `portal:last-project:${slug}:${userId ?? "anon"}`;

export function pickRememberedProject(
  raw: string | null,
  projects: { id: string }[],
  now = Date.now(),
): string | null {
  if (!raw) return null;
  try {
    const { projectId, savedAt } = JSON.parse(raw) as { projectId?: unknown; savedAt?: unknown };
    if (typeof projectId !== "string" || typeof savedAt !== "number") return null;
    if (now - savedAt > LAST_PROJECT_TTL_MS || savedAt > now) return null;
    return projects.some((p) => p.id === projectId) ? projectId : null;
  } catch {
    return null;
  }
}

export function recallLastProject(slug: string, userId: string | null | undefined, projects: { id: string }[]): string | null {
  try {
    return pickRememberedProject(localStorage.getItem(lastProjectKey(slug, userId)), projects);
  } catch {
    return null; // storage blocked (private mode, disabled site data)
  }
}

export function rememberLastProject(slug: string, userId: string | null | undefined, projectId: string) {
  try {
    localStorage.setItem(lastProjectKey(slug, userId), JSON.stringify({ projectId, savedAt: Date.now() }));
  } catch {
    // Only a convenience: nothing to do if storage is blocked.
  }
}

export async function postCreateIssue(payload: CreateIssuePayload) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/issues/create`, {
    method: "POST",
    headers: API_HEADERS,
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    // The server says why when it has a reason (e.g. a completed project).
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? "Failed to create issue");
  }
  return res.json();
}

export async function fetchProjects(slug: string) {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/issues/projects?slug=${encodeURIComponent(slug)}`,
    { headers: API_HEADERS },
  );
  if (!res.ok) throw new Error("Failed to fetch projects");
  return res.json() as Promise<{ id: string; name: string }[]>;
}

export async function fetchMilestones(projectId: string) {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/issues/milestones?projectId=${encodeURIComponent(projectId)}`,
    { headers: API_HEADERS },
  );
  if (!res.ok) throw new Error("Failed to fetch milestones");
  return res.json() as Promise<{ id: string; name: string; targetDate: string | null }[]>;
}
