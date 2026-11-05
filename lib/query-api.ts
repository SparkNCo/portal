import { supabase } from "@/lib/supabase-client";
import { API_JSON_HEADERS } from "@/lib/api-headers";

// The `query` edge function (SPA-492): a plain-text question about one of a
// client's connected databases. Admins only, checked from the session token.

export type QueryAnswer = {
  question: string;
  explanation: string;
  sql: string;
  columns?: string[];
  rows?: unknown[][];
  truncated?: boolean;
  error?: string;
};

export async function askQuestion(dataSourceId: string, question: string): Promise<QueryAnswer> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/query`, {
    method: "POST",
    headers: { ...API_JSON_HEADERS, Authorization: `Bearer ${session?.access_token ?? ""}` },
    body: JSON.stringify({ dataSourceId, question }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? "Couldn't answer the question");
  }
  return res.json();
}
