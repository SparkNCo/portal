import { supabase } from "@/lib/supabase-client";
import { API_JSON_HEADERS } from "@/lib/api-headers";

// Calls to the `data-sources` edge function (Query, SPA-488). It's admins
// only and checks that from the session token, so every call sends it.

const BASE_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/data-sources`;

export type ConnectionDetails = {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl: boolean;
};

export type DataSource = {
  id: string;
  customer_id: string;
  name: string;
  type: "postgres";
  host: string;
  port: number;
  database_name: string;
  username: string;
  ssl: boolean;
  schema_path: string | null;
  schema_refreshed_at: string | null;
  schema_error: string | null;
  created_at: string;
  updated_at: string;
};

async function authHeaders() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return { ...API_JSON_HEADERS, Authorization: `Bearer ${session?.access_token ?? ""}` };
}

async function errorFrom(res: Response, fallback: string): Promise<Error> {
  const body = await res.json().catch(() => null);
  return new Error(body?.error ?? fallback);
}

// Null if the database answered; otherwise why it didn't.
export async function testDataSourceConnection(details: ConnectionDetails): Promise<string | null> {
  const res = await fetch(`${BASE_URL}/test`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify(details),
  });
  if (!res.ok) throw await errorFrom(res, "Couldn't test the connection");
  const body = (await res.json()) as { ok: boolean; error?: string };
  return body.ok ? null : (body.error ?? "Couldn't connect");
}

export async function createDataSource(
  slug: string,
  input: ConnectionDetails & { name: string },
): Promise<DataSource> {
  const res = await fetch(BASE_URL, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({ ...input, slug }),
  });
  if (!res.ok) throw await errorFrom(res, "Couldn't save the connection");
  return res.json();
}
