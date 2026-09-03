import { API_JSON_HEADERS as API_HEADERS } from "@/lib/api-headers";

export interface HoursLogEntry {
  id: string;
  developer_id: string;
  developer_email: string;
  project_slug: string;
  project_name: string;
  hours: number;
  worked_on: string;
  issue_ids: string[];
  summary: string | null;
  created_at: string;
  updated_at: string;
}

export interface LogHoursPayload {
  developer_id: string;
  developer_email: string;
  project_slug: string;
  project_name: string;
  hours: number;
  worked_on: string;
  issue_ids?: string[];
  summary?: string;
}

export async function postLogHours(payload: LogHoursPayload) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/hours`, {
    method: "POST",
    headers: API_HEADERS,
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to log hours");
  return res.json() as Promise<HoursLogEntry>;
}

export async function fetchHours(developerId: string) {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/hours?developer_id=${encodeURIComponent(developerId)}`,
    { headers: API_HEADERS },
  );
  if (!res.ok) throw new Error("Failed to fetch logged hours");
  return res.json() as Promise<HoursLogEntry[]>;
}

export interface UpdateHoursPayload {
  id: string;
  developer_id: string;
  hours: number;
  worked_on: string;
  project_slug: string;
  project_name: string;
  issue_ids?: string[];
  summary?: string;
}

export async function patchLogHours(payload: UpdateHoursPayload) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/hours`, {
    method: "PATCH",
    headers: API_HEADERS,
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to update logged hours");
  return res.json() as Promise<HoursLogEntry>;
}

export async function deleteLogHours(id: string, developerId: string) {
  const params = new URLSearchParams({ id, developer_id: developerId });
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/hours?${params.toString()}`,
    { method: "DELETE", headers: API_HEADERS },
  );
  if (!res.ok) throw new Error("Failed to delete logged hours entry");
  return res.json();
}
