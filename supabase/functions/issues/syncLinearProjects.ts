// @ts-nocheck
import { supabase } from "../client.ts";
import { linearRequest, GET_INITIATIVE_PROJECTS_QUERY } from "./linearClient.ts";

// `customers.linear_projects` is otherwise a one-time snapshot taken at
// customer creation (or lazily on the first /issues fetch) — it never
// updates again as new projects get added to the Linear initiative, so
// panels reading from it (Business Review, UAT, Bugs) silently stop
// covering those new projects. Re-syncing it here keeps it current.
// Returns the freshly-synced project ids on success, or `null` if the sync
// itself failed (network hiccup, Linear rate limit, etc.) — callers should
// fall back to whatever `linear_projects` already had rather than treating
// a failed sync as "this customer has no projects".
export async function syncCustomerLinearProjects(
  customerId: string,
  linearSlug: string,
  schema: string,
): Promise<string[] | null> {
  try {
    const initiativeData = await linearRequest(GET_INITIATIVE_PROJECTS_QUERY, {
      initiativeId: linearSlug,
    });
    const projectIds: string[] = (initiativeData?.initiative?.projects?.nodes ?? []).map(
      (p: { id: string }) => p.id,
    );

    const { error } = await supabase.schema(schema)
      .from("customers")
      .update({ linear_projects: projectIds })
      .eq("customer_id", customerId);

    if (error) {
      console.error("[syncCustomerLinearProjects] Failed to update customers.linear_projects:", error);
    }

    return projectIds;
  } catch (err) {
    console.error("[syncCustomerLinearProjects] Failed to re-sync from Linear initiative:", err);
    return null;
  }
}
