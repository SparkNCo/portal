import { API_JSON_HEADERS as API_HEADERS } from "@/lib/api-headers";

// The same rule the hours function and the database check: 0.5 to 24 per
// entry, in half hours. Relative path on purpose: "supabase" alone would
// resolve to the CLI package in node_modules.
export {
  HOURS_STEP,
  MAX_HOURS_PER_ENTRY,
  isValidHours,
  entryTickets,
  savedTicketLabel,
  type LoggedTicket,
} from "../supabase/functions/hours/hoursRules";
import type { LoggedTicket } from "../supabase/functions/hours/hoursRules";

export interface HoursLogEntry {
  id: string;
  developer_id: string;
  developer_email: string;
  project_slug: string;
  project_name: string;
  hours: number;
  worked_on: string;
  issue_ids: string[];
  // Code and title of each ticket, as saved with the entry. Empty on entries
  // from before they were saved: read them with entryTickets (falls back to
  // issue_ids, looked up by id).
  tickets?: LoggedTicket[];
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
  tickets?: LoggedTicket[];
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
  tickets?: LoggedTicket[];
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
