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
}

export async function postCreateIssue(payload: CreateIssuePayload) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/issues/create`, {
    method: "POST",
    headers: API_HEADERS,
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to create issue");
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
