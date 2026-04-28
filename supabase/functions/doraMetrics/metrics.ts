// @ts-nocheck

const FAILURE_LABELS = ["bug", "incident", "hotfix", "rollback", "revert"];

interface RawIssue {
  id: string;
  createdAt: string;
  completedAt: string;
  state: { name: string; type: string };
  labels: { nodes: { name: string }[] };
}

function isFailure(issue: RawIssue): boolean {
  const labelNames = issue.labels?.nodes?.map((l) => l.name.toLowerCase()) ?? [];
  return labelNames.some((name) =>
    FAILURE_LABELS.some((kw) => name.includes(kw)),
  );
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function buildDoraMetrics(
  projects: { projectId: string; projectName: string; issues: RawIssue[] }[],
  daysWindow: number,
) {
  const allIssues = projects.flatMap((p) => p.issues);

  // ── Deployment Frequency ────────────────────────────────────────────────────
  const countsByDate: Record<string, number> = {};
  for (const issue of allIssues) {
    const date = issue.completedAt.split("T")[0];
    countsByDate[date] = (countsByDate[date] ?? 0) + 1;
  }

  const daily = Object.entries(countsByDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));

  const totalDeployments = allIssues.length;
  const deploymentsPerDay =
    daysWindow > 0 ? totalDeployments / daysWindow : 0;

  const deploymentFrequency = {
    per_day: Math.round(deploymentsPerDay * 100) / 100,
    per_week: Math.round(deploymentsPerDay * 7 * 100) / 100,
    total: totalDeployments,
    days_window: daysWindow,
    daily,
  };

  // ── Lead Time for Changes ───────────────────────────────────────────────────
  const leadTimesHours = allIssues
    .filter((i) => i.createdAt && i.completedAt)
    .map((i) => {
      const ms =
        new Date(i.completedAt).getTime() - new Date(i.createdAt).getTime();
      return ms / (1000 * 60 * 60); // → hours
    })
    .filter((h) => h >= 0);

  const meanHours =
    leadTimesHours.length > 0
      ? leadTimesHours.reduce((s, h) => s + h, 0) / leadTimesHours.length
      : 0;
  const medianHours = median(leadTimesHours);

  const leadTimeForChanges = {
    mean_hours: Math.round(meanHours * 100) / 100,
    mean_days: Math.round((meanHours / 24) * 100) / 100,
    median_hours: Math.round(medianHours * 100) / 100,
    median_days: Math.round((medianHours / 24) * 100) / 100,
    sample_size: leadTimesHours.length,
  };

  // ── Change Failure Rate ──────────────────────────────────────────────────────
  const failures = allIssues.filter(isFailure);
  const changeFailureRate = {
    percentage:
      totalDeployments > 0
        ? Math.round((failures.length / totalDeployments) * 10000) / 100
        : 0,
    failures: failures.length,
    total: totalDeployments,
  };

  // ── Per-project breakdown ────────────────────────────────────────────────────
  const byProject = projects.map((p) => {
    const count = p.issues.length;
    const ltHours = p.issues
      .filter((i) => i.createdAt && i.completedAt)
      .map((i) => {
        const ms =
          new Date(i.completedAt).getTime() - new Date(i.createdAt).getTime();
        return ms / (1000 * 60 * 60);
      })
      .filter((h) => h >= 0);

    const meanH =
      ltHours.length > 0
        ? ltHours.reduce((s, h) => s + h, 0) / ltHours.length
        : 0;

    const fail = p.issues.filter(isFailure).length;

    return {
      project_id: p.projectId,
      project_name: p.projectName,
      deployments: count,
      lead_time_mean_days: Math.round((meanH / 24) * 100) / 100,
      failures: fail,
      change_failure_rate_pct:
        count > 0 ? Math.round((fail / count) * 10000) / 100 : 0,
    };
  });

  return {
    deployment_frequency: deploymentFrequency,
    lead_time_for_changes: leadTimeForChanges,
    change_failure_rate: changeFailureRate,
    by_project: byProject,
  };
}
