// @ts-nocheck
import { supabase } from "../client.ts";

export async function getCustomerBySlug(slug: string) {
  const { data, error } = await supabase.schema("portal")
    .from("customers")
    .select(
      `
      customer_id,
      linear_projects,
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

export async function getProjectIdsBySlug(slug: string): Promise<string[]> {
  const { data, error } = await supabase.schema("portal")
    .from("customers")
    .select("linear_projects")
    .eq("linear_slug", slug)
    .maybeSingle();

  if (error) throw new Error(`Failed to fetch customer: ${error.message}`);
  if (!data) throw new Error(`Customer not found for slug: ${slug}`);
  return data.linear_projects ?? [];
}

// issue_metrics / cycle_metrics key off the customer's user row id (role = "customer"),
// not the customers table's own customer_id, so each client record is paired with its user.
export async function getAllCustomers() {
  const { data: clients, error: clientsError } = await supabase.schema("portal")
    .from("customers")
    .select("customer_id, linear_projects, linear_slug")
    .not("linear_projects", "is", null);

  if (clientsError) {
    throw new Error(`Failed to fetch customers: ${clientsError.message}`);
  }

  const clientIds = (clients ?? []).map((c) => c.customer_id);
  if (!clientIds.length) return [];

  const { data: customerUsers, error: usersError } = await supabase.schema("portal")
    .from("users")
    .select("id, customer_id")
    .eq("role", "customer")
    .in("customer_id", clientIds);

  if (usersError) {
    throw new Error(`Failed to fetch customer users: ${usersError.message}`);
  }

  const userByClientId = new Map((customerUsers ?? []).map((u) => [u.customer_id, u.id]));

  return (clients ?? [])
    .filter((c) => userByClientId.has(c.customer_id))
    .map((c) => ({
      id: userByClientId.get(c.customer_id),
      linear_projects: c.linear_projects,
      linear_slug: c.linear_slug,
    }));
}

export async function upsertCycleMetrics(cycles: any[]) {
  if (!cycles.length) return;

  const cycleIds = cycles.map((c) => c.cycle_id);
  const { data: existing } = await supabase.schema("portal")
    .from("cycle_metrics")
    .select("project_id, cycle_id, issues_averages")
    .in("cycle_id", cycleIds);

  const existingMap = new Map(
    (existing ?? []).map((r) => [`${r.project_id}:${r.cycle_id}`, r.issues_averages ?? []]),
  );

  const payload = cycles.map(({ _snapshot, ...cycle }) => {
    const prev: any[] = existingMap.get(`${cycle.project_id}:${cycle.cycle_id}`) ?? [];
    const merged = [
      ...prev.filter((e) => e.date !== _snapshot.date),
      _snapshot,
    ];
    return { ...cycle, issues_averages: merged };
  });

  const { error } = await supabase.schema("portal")
    .from("cycle_metrics")
    .upsert(payload, { onConflict: "customer_id,project_id,cycle_id" });

  if (error) {
    throw new Error(`Cycle upsert failed: ${error.message}`);
  }
}

export async function getMetricsBySlug(projectIds: string[]) {
  const [cycleResult, issueResult] = await Promise.all([
    supabase.schema("portal")
      .from("cycle_metrics")
      .select("*")
      .in("project_id", projectIds)
      .order("number", { ascending: true }),
    supabase.schema("portal").from("issue_metrics").select("*").in("project_id", projectIds),
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
  const { data, error } = await supabase.schema("portal")
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
  const { data, error } = await supabase.schema("portal")
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

  const { error } = await supabase.schema("portal")
    .from("issue_metrics")
    .upsert(metrics, { onConflict: "cycle_issue_id" });

  if (error) {
    throw new Error(`Upsert failed: ${error.message}`);
  }
}
