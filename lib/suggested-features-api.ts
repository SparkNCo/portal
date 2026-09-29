import { API_HEADERS, API_JSON_HEADERS } from "@/lib/api-headers";

export type SuggestedFeature = {
  id: string;
  project_slug: string;
  linear_project_id: string;
  linear_project_name: string;
  linear_milestone_id: string | null;
  linear_milestone_name: string | null;
  title: string;
  description: string;
  status: "pending" | "accepted" | "declined";
  priority: "low" | "medium" | "high" | "urgent" | null;
  linear_issue_id: string | null;
  linear_issue_identifier: string | null;
  created_at: string;
  updated_at: string;
};

// `slug` is the caller's clientName-based route slug — the backend resolves
// it to the customer's linear_slug itself (see generateSuggestion.ts/
// listSuggestions.ts), same as every other Build-page fetch already does.
export async function fetchSuggestedFeatures(slug: string) {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/suggested-features?slug=${encodeURIComponent(slug)}`,
    { headers: API_HEADERS },
  );
  if (!res.ok) throw new Error("Failed to fetch suggested features");
  return res.json() as Promise<SuggestedFeature[]>;
}

// `actorEmail` is re-checked server-side (admin/customer/stakeholder only —
// this is a product/roadmap call, not a developer one) — see authorize.ts.
export async function acceptSuggestedFeature(id: string, priority: string, actorEmail: string) {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/suggested-features/accept`,
    {
      method: "POST",
      headers: API_JSON_HEADERS,
      body: JSON.stringify({ id, priority, actorEmail }),
    },
  );
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? "Failed to accept suggestion");
  }
  return res.json() as Promise<SuggestedFeature>;
}

export async function declineSuggestedFeature(id: string, actorEmail: string) {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/suggested-features/decline`,
    {
      method: "POST",
      headers: API_JSON_HEADERS,
      body: JSON.stringify({ id, actorEmail }),
    },
  );
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? "Failed to decline suggestion");
  }
  return res.json() as Promise<SuggestedFeature>;
}

// `milestoneId: null` clears the suggestion back to "no milestone".
export async function updateSuggestionMilestone(
  id: string,
  milestoneId: string | null,
  actorEmail: string,
) {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/suggested-features/milestone`,
    {
      method: "PATCH",
      headers: API_JSON_HEADERS,
      body: JSON.stringify({ id, milestoneId, actorEmail }),
    },
  );
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? "Failed to update milestone");
  }
  return res.json() as Promise<SuggestedFeature>;
}

// Moves the suggestion to a different project within the same customer's
// initiative (re-validated server-side against customers.linear_projects).
// Clears the milestone on success — the backend resets it since it belonged
// to the old project.
export async function updateSuggestionProject(id: string, projectId: string, actorEmail: string) {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/suggested-features/project`,
    {
      method: "PATCH",
      headers: API_JSON_HEADERS,
      body: JSON.stringify({ id, projectId, actorEmail }),
    },
  );
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? "Failed to update project");
  }
  return res.json() as Promise<SuggestedFeature>;
}
