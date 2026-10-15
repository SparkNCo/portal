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

// A connection's structure as last read (supabase/functions/data-sources/introspect.ts).
export type DatabaseStructure = {
  dataSourceId: string;
  database: string;
  refreshedAt: string;
  tables: {
    schema: string;
    name: string;
    kind: "table" | "view" | "materialized view" | "foreign table";
    comment: string | null;
    columns: { name: string; type: string; nullable: boolean; comment: string | null }[];
    primaryKey: string[];
    foreignKeys: { columns: string[]; references: { schema: string; table: string; columns: string[] } }[];
  }[];
  enums: { schema: string; name: string; values: string[] }[];
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

export async function listDataSources(slug: string): Promise<DataSource[]> {
  const res = await fetch(`${BASE_URL}?slug=${encodeURIComponent(slug)}`, { headers: await authHeaders() });
  if (!res.ok) throw await errorFrom(res, "Couldn't load the connections");
  return res.json();
}

// Null if the database answered; otherwise why it didn't. With `id`, tests
// that saved connection — an empty password then means its stored one.
export async function testDataSourceConnection(
  details: ConnectionDetails,
  id?: string,
): Promise<string | null> {
  const res = await fetch(`${BASE_URL}/test`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify(id ? { ...details, id } : details),
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

// An empty password keeps the current one.
export async function updateDataSource(
  id: string,
  input: ConnectionDetails & { name: string },
): Promise<DataSource> {
  const res = await fetch(`${BASE_URL}/${id}`, {
    method: "PATCH",
    headers: await authHeaders(),
    body: JSON.stringify(input),
  });
  if (!res.ok) throw await errorFrom(res, "Couldn't save the changes");
  return res.json();
}

// Reads the connection's structure again. Resolves with the updated
// connection even when that fails — the reason is in `schema_error`.
export async function refreshDataSourceStructure(id: string): Promise<DataSource> {
  const res = await fetch(`${BASE_URL}/${id}/refresh-structure`, { method: "POST", headers: await authHeaders() });
  if (!res.ok) throw await errorFrom(res, "Couldn't read the structure");
  return res.json();
}

export async function fetchDataSourceStructure(id: string): Promise<DatabaseStructure> {
  const res = await fetch(`${BASE_URL}/${id}/structure`, { headers: await authHeaders() });
  if (!res.ok) throw await errorFrom(res, "Couldn't load its structure");
  return res.json();
}

export async function deleteDataSource(id: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/${id}`, { method: "DELETE", headers: await authHeaders() });
  if (!res.ok) throw await errorFrom(res, "Couldn't delete the connection");
}
