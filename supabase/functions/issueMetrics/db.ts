// @ts-nocheck
import { supabase } from "../client.ts";

export async function getCustomerBySlug(slug: string) {
  const { data, error } = await supabase
    .from("users")
    .select(
      `
      linear_projects,
      linear_initiative_id,
      linear_slug
    `,
    )
    .eq("linear_slug", slug)
    .maybeSingle();

  if (error || !data) {
    throw new Error("Customer not found");
  }

  return data;
}

export async function getAllCustomers() {
  const { data, error } = await supabase
    .from("customers")
    .select("linear_projects, linear_slug")
    .not("linear_projects", "is", null);

  if (error) {
    throw new Error(`Failed to fetch customers: ${error.message}`);
  }

  return data ?? [];
}

export async function upsertCycleMetrics(cycles: any[]) {
  if (!cycles.length) return;

  const { error } = await supabase
    .from("cycle_metrics")
    .upsert(cycles, { onConflict: "customer_id,project_id,cycle_id" });

  if (error) {
    throw new Error(`Cycle upsert failed: ${error.message}`);
  }
}

export async function getMetricsBySlug(projectIds: string[]) {
  const [cycleResult, issueResult] = await Promise.all([
    supabase
      .from("cycle_metrics")
      .select("*")
      .in("project_id", projectIds)
      .order("number", { ascending: true }),
    supabase.from("issue_metrics").select("*").in("project_id", projectIds),
  ]);

  if (cycleResult.error) {
    throw new Error(`Cycle metrics fetch failed: ${cycleResult.error.message}`);
  }
  if (issueResult.error) {
    throw new Error(`Issue metrics fetch failed: ${issueResult.error.message}`);
  }

  return {
    cycle_metrics: cycleResult.data,
    issue_metrics: issueResult.data,
  };
}

export async function getCycleMetricsByCustomerId(slug: string) {
  const { data, error } = await supabase
    .from("cycle_metrics")
    .select("*")
    .eq("customer_id", slug)
    .order("number", { ascending: true });

  if (error) {
    throw new Error(`Cycle metrics fetch failed: ${error.message}`);
  }

  return data ?? [];
}

export async function getIssueMetricsByCustomerId(slug: string) {
  const { data, error } = await supabase
    .from("issue_metrics")
    .select("*")
    .eq("customer_id", slug);

  if (error) {
    throw new Error(`Issue metrics fetch failed: ${error.message}`);
  }

  return data ?? [];
}

export async function upsertIssueMetrics(metrics: any[]) {
  if (!metrics.length) return;

  const { error } = await supabase
    .from("issue_metrics")
    .upsert(metrics, { onConflict: "cycle_issue_id" });

  if (error) {
    throw new Error(`Upsert failed: ${error.message}`);
  }
}
