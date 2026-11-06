import { supabase } from "@/lib/supabase-client";
import { API_JSON_HEADERS } from "@/lib/api-headers";

// The `query` edge function (SPA-492): a plain-text question asked of every
// listed connection of a client at once. Admins only, checked from the
// session token.

export type QueryResultTable = {
  columns: string[];
  rows: unknown[][];
  truncated?: boolean;
};

// One connection's answer (supabase/functions/query/combineAnswers.ts).
export type ConnectionAnswer = {
  dataSourceId: string;
  dataSourceName: string;
  explanation: string;
  sql: string;
  columns?: string[];
  rows?: unknown[][];
  truncated?: boolean;
  error?: string;
  // This database doesn't hold what was asked — not a failure.
  unanswerable?: boolean;
};

export type QueryAnswer = {
  question: string;
  answers: ConnectionAnswer[];
  // Set when 2+ connections answered: all their rows in one table, with a
  // leading "Connection" column and every column any of them returned.
  combined: QueryResultTable | null;
};

export async function askQuestion(dataSourceIds: string[], question: string): Promise<QueryAnswer> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/query`, {
    method: "POST",
    headers: { ...API_JSON_HEADERS, Authorization: `Bearer ${session?.access_token ?? ""}` },
    body: JSON.stringify({ dataSourceIds, question }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? "Couldn't answer the question");
  }
  return res.json();
}
