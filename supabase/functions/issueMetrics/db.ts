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

  const cycleIds = cycles.map((c) => c.cycle_id);
  const { data: existing } = await supabase
    .from("cycle_metrics")
    .select("cycle_id, issues_averages")
    .in("cycle_id", cycleIds);

  const existingMap = new Map(
    (existing ?? []).map((r) => [r.cycle_id, r.issues_averages ?? []]),
  );

  const payload = cycles.map(({ _snapshot, ...cycle }) => {
    const prev: any[] = existingMap.get(cycle.cycle_id) ?? [];
    const merged = [...prev.filter((e) => e.date !== _snapshot.date), _snapshot];
    return { ...cycle, issues_averages: merged };
  });

  const { error } = await supabase
    .from("cycle_metrics")
    .upsert(payload, { onConflict: "customer_id,project_id,cycle_id" });

  if (error) {
    throw new Error(`Cycle upsert failed: ${error.message}`);
  }

  // For newly inserted cycles, mark the previous cycle as inactive and append a final snapshot
  const newCycles = cycles.filter((c) => !existingMap.has(c.cycle_id));
  if (!newCycles.length) return;

  const today = new Date().toISOString().split("T")[0];

  await Promise.all(
    newCycles.map(async (cycle) => {
      const prevNumber = cycle.number - 1;
      if (prevNumber < 1) return;

      const { data: prevCycle } = await supabase
        .from("cycle_metrics")
        .select("cycle_id, issues_averages")
        .eq("customer_id", cycle.customer_id)
        .eq("project_id", cycle.project_id)
        .eq("number", prevNumber)
        .maybeSingle();

      if (!prevCycle) return;

      const updatePayload: any = { is_active: false };

      const prevAverages: any[] = prevCycle.issues_averages ?? [];
      if (prevAverages.length && !prevAverages.some((e) => e.date === today)) {
        const lastSnapshot = prevAverages.at(-1);
        updatePayload.issues_averages = [...prevAverages, { ...lastSnapshot, date: today }];
      }

      await supabase
        .from("cycle_metrics")
        .update(updatePayload)
        .eq("cycle_id", prevCycle.cycle_id);
    }),
  );
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
