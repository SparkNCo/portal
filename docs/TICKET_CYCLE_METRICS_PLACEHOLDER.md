# [issueMetrics] Write a placeholder row when a project has no active cycle

## Problem

For a customer whose project(s) don't have an active cycle in Linear at the
time `issueMetrics` runs, `cycle_metrics` never gets a row written for that
project on that day. This makes it look like the pipeline has stopped
running entirely for that customer, when in fact it ran successfully — it
just had nothing to report, because of this chain in
`supabase/functions/issueMetrics/index.ts` (`processIssueMetricsForCustomer`)
and `supabase/functions/issueMetrics/metrics.ts` (`buildCycleMetrics`):

1. `fetchProjectDetails` fetches the project's issues from Linear.
2. Only issues whose `issue.cycle.isActive === true` get added to
   `cyclesByProjectLight` for that project.
3. If a project has **zero** active cycles, `cycles` for that project is `[]`.
4. `buildCycleMetrics` loops `for (const cycle of cycles)` per project — with
   `cycles = []`, this loop body never runs, so **no row is pushed** to the
   result array for that project.
5. If the customer's *only* project(s) have no active cycle that day, the
   final `cycles` array passed to `upsertCycleMetrics` can end up completely
   empty, and `upsertCycleMetrics` short-circuits (`if (!cycles.length) return;`)
   — nothing is written at all.

Net effect: a customer can go a full day (or longer, if they're between
sprints / don't use Linear cycles actively) with literally zero `cycle_metrics`
writes, which is indistinguishable from "the cron/function is broken" when
looking at the data.

## Proposed solution

In `buildCycleMetrics` (`supabase/functions/issueMetrics/metrics.ts`), when a
project's `cycles` array is empty, push a placeholder row instead of
skipping the project entirely — a zeroed snapshot for today's date, using a
fixed synthetic `cycle_id` so it upserts into the *same* row every day
(instead of creating a new row per day).

```ts
export function buildCycleMetrics(
  cyclesByProject: { projectId: string; projectName: string; cycles: any[] }[],
  customerId: string,
  issueMetrics: any[],
  cycleIssues: { cycleId: string; projectId: string; issues: any[] }[],
) {
  const today = new Date().toISOString().split("T")[0];
  const result = [];

  for (const { projectId, projectName, cycles } of cyclesByProject) {
    // No active cycle right now — write a placeholder row with a zeroed
    // snapshot instead of silently producing nothing, so it's visible the
    // pipeline is still running for this project rather than having stopped.
    // Fixed synthetic cycle_id (not tied to any real cycle) so this upserts
    // into the same row every day instead of piling up duplicates.
    if (cycles.length === 0) {
      result.push({
        customer_id: customerId,
        project_id: projectId,
        project_name: projectName,
        // A real all-zeros UUID literal, not a made-up string — safe whether
        // `cycle_id` is typed as `uuid` or plain text in Postgres.
        cycle_id: "00000000-0000-0000-0000-000000000000",
        name: "No active cycle",
        description: null,
        completed_at: null,
        starts_at: null,
        ends_at: null,
        is_active: false,
        number: null,
        scope_history: [],
        completed_scope_history: [],
        uncompleted_issues_upon_close: [],
        cycle_issue_ids: [],
        _snapshot: { date: today },
      });
      continue;
    }

    for (const cycle of cycles) {
      // ...existing per-cycle logic, unchanged...
    }
  }

  return result;
}
```

The `_snapshot: { date: today }` intentionally carries no status keys — the
frontend ("Issues by Status" chart, `components/metrics/issues-metrics.tsx`)
already renders any status missing from a snapshot as `0` (fixed order,
fixed color, defaults to 0), so an empty snapshot already reads as "every
status = 0 today" without needing to enumerate them explicitly.

## Open risk to verify before merging

`cycle_metrics`'s schema isn't tracked in this repo's migrations, so the
exact column types/constraints for `number`, `name`, etc. (all set to `null`
in the placeholder) can't be confirmed from code. Before applying for real,
check in the Supabase dashboard whether any of those columns are `NOT NULL`
— if so, adjust the placeholder values accordingly (e.g. `number: 0` instead
of `null`).

## How to test

1. Apply the diff above to `supabase/functions/issueMetrics/metrics.ts`.
2. Deploy: `npx supabase functions deploy issueMetrics`.
3. Manually trigger the function (POST to
   `/functions/v1/issueMetrics` with the service role key) for a customer
   known to currently have no active cycle.
4. Check `portal.cycle_metrics` for a new/updated row with
   `cycle_id = '00000000-0000-0000-0000-000000000000'` and today's date in
   `issues_averages`.
5. Confirm the "Issues by Status" chart for that customer still renders
   correctly (all-zero line for today) and doesn't error out.

## Status

Built and verified to type-check during a debugging session, then reverted
before merging (not wanted at the time). Keeping this ticket so it can be
picked up and tried again later without redoing the investigation.
