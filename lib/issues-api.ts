import { API_JSON_HEADERS as API_HEADERS } from "@/lib/api-headers";

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
