// @ts-nocheck

export function buildIssueMetrics(initiative: any, customerId: string) {
  const metricsMap = new Map();
  const today = new Date().toISOString().split("T")[0];

  for (const project of initiative.projects.nodes) {
    for (const milestone of project.projectMilestones.nodes) {
      for (const issue of milestone.issues || []) {
        const cycleId = issue.cycle?.id || "no-cycle";
        const status = issue.state?.name || "unknown";
        const label = issue.labels?.nodes?.[0]?.name || "no-label";

        const key = `${project.id}-${status}-${label}-${cycleId}`;

        if (!metricsMap.has(key)) {
          metricsMap.set(key, {
            cycle_issue_id: key,
            customer_id: customerId,
            project_id: project.id,
            status,
            label,
            date_collected: today,
            count: 0,
            points: 0,
            cycle: cycleId,
            titles: [],
          });
        }

        const entry = metricsMap.get(key);

        entry.count += 1;
        entry.points += issue.estimate || 0;
        if (issue.title) entry.titles.push(issue.title);
      }
    }
  }

  return Array.from(metricsMap.values());
}

export function buildCycleMetrics(
  cyclesByProject: { projectId: string; cycles: any[] }[],
  customerId: string,
) {
  const result = [];

  for (const { projectId, cycles } of cyclesByProject) {
    for (const cycle of cycles) {
      result.push({
        customer_id: customerId,
        project_id: projectId,
        cycle_id: cycle.id,
        name: cycle.name,
        description: cycle.description ?? null,
        completed_at: cycle.completedAt ?? null,
        starts_at: cycle.startsAt ?? null,
        ends_at: cycle.endsAt ?? null,
        is_active: cycle.isActive ?? false,
        number: cycle.number,
        scope_history: cycle.scopeHistory ?? [],
        completed_scope_history: cycle.completedScopeHistory ?? [],
        uncompleted_issues_upon_close:
          cycle.uncompletedIssuesUponClose?.nodes ?? [],
      });
    }
  }

  return result;
}
