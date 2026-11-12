import { supabase } from "@/lib/supabase-client";
import { API_JSON_HEADERS } from "@/lib/api-headers";

// The global query (SPA-582): a question about one client's project, answered
// from its documents, test cases and issues. See supabase/functions/ask.

export type AskSourceType = "document" | "test" | "issue";

export type AskSource = {
  type: AskSourceType;
  // Document id, test case id, or the issue's Linear id.
  id: string;
  // How it's named in the answer: the issue identifier (SPA-456), the
  // document's id, the test case's short id.
  ref: string;
  title: string;
  // Issues only.
  status: string | null;
  // Issues only: bugs open on the Bugs page, everything else on Build.
  kind?: "bug" | "feature" | null;
};

export type AskAnswer = {
  question: string;
  // false: nothing in the project covers the question (answer is empty or
  // says so).
  found: boolean;
  answer: string;
  sources: AskSource[];
};

export const MAX_QUESTION_LENGTH = 500;

// Uses the session's token: the function checks the caller can see `slug`.
export async function askProject(slug: string, question: string): Promise<AskAnswer> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/ask`, {
    method: "POST",
    headers: { ...API_JSON_HEADERS, Authorization: `Bearer ${session?.access_token ?? ""}` },
    body: JSON.stringify({ slug, question }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? "Couldn't answer the question. Please try again.");
  }
  return res.json();
}
