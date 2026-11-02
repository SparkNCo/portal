import { supabase } from "@/lib/supabase-client";
import { API_JSON_HEADERS } from "@/lib/api-headers";
import { type TicketSettings, ticketSettingsBody } from "@/lib/ticket-systems";

export type TicketConnectionResult = { ok: true; accountName: string; projectName: string } | { ok: false; error: string };

// "Test connection" in Add/Edit Customer: checks the Jira account and
// project without saving. `customerId` lets a blank token fall back to the
// stored one (editing). Admins only, checked from the session token.
export async function testTicketConnection(settings: TicketSettings, customerId?: string): Promise<TicketConnectionResult> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const { linear_slug, ...body } = ticketSettingsBody(settings);
  const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/users?type=ticket-connection-test`, {
    method: "POST",
    headers: { ...API_JSON_HEADERS, Authorization: `Bearer ${session?.access_token ?? ""}` },
    body: JSON.stringify({ ...body, project_key: linear_slug, ...(customerId && { customer_id: customerId }) }),
  });
  const result = await res.json().catch(() => null);
  if (!res.ok) {
    return { ok: false, error: result?.error ?? `Couldn't test the connection (${res.status})` };
  }
  return result;
}
