import { redis } from "@/lib/redis/redis";
import { linearClient } from "../linear/LinearClient";

type IssuesParams = {
  projectId: string;
};

async function refreshIssuesCache(projectId: string) {
  const fresh = await fetchFreshIssues(projectId);
  await redis.set(`linear:issues:${projectId}`, fresh, { ex: 120 });
}

async function fetchFreshIssues(projectId: string) {
  const issuesConnection = await linearClient.issues({
    first: 100,
    filter: {
      project: {
        id: {
          in: [projectId],
        },
      },
      state: {
        name: {
          in: null,
        },
      },
    },
  });
  return Promise.all(
    issuesConnection.nodes.map(async (issue) => {
      const cycle = issue.cycle ? await issue.cycle : null;
      const assignee = issue.assignee ? await issue.assignee : null;
      const creator = issue.creator ? await issue.creator : null;
      const state = issue.state ? await issue.state : null;

      const labels = issue.labels
        ? (await issue.labels({ last: 4 })).nodes.map((l) => l.name)
        : [];

      const comments = issue.comments
        ? await Promise.all(
            (await issue.comments({ last: 5 })).nodes.map(async (c) => {
              const user = c.user ? await c.user : null;
              const bodyData = c.bodyData ? await c.bodyData : null;

              return {
                bodyData,
                createdAt: c.createdAt,
                editedAt: c.editedAt,
                resolvedAt: c.resolvedAt,
                user: user?.displayName ?? null,
              };
            }),
          )
        : [];

      const documents = issue.documents
        ? (await issue.documents({ last: 5 })).nodes.map((d) => ({
            title: d.title,
            url: d.url,
          }))
        : [];

      return {
        title: issue.title,
        url: issue.url,
        id: issue.id,
        updatedAt: issue.updatedAt,
        description: issue.description,
        activitySummary: issue.activitySummary
          ? await issue.activitySummary
          : null,
        branchName: issue.branchName,
        createdAt: issue.createdAt,
        completedAt: issue.completedAt,
        canceledAt: issue.canceledAt,
        dueDate: issue.dueDate,
        estimate: issue.estimate,
        priorityLabel: issue.priorityLabel,
        prioritySortOrder: issue.prioritySortOrder,
        number: issue.number,
        cycle: cycle
          ? {
              startsAt: cycle.startsAt,
              endsAt: cycle.endsAt,
              isActive: cycle.isActive,
              isPast: cycle.isPast,
              isFuture: cycle.isFuture,
            }
          : null,
        assignee: assignee?.displayName ?? null,
        creator: creator?.displayName ?? null,
        labels,
        comments,
        documents,
        state: state ? { name: state.name } : null,
      };
    }),
  );
}

export async function getIssues({ projectId }: IssuesParams) {
  const cacheKey = `linear:issues:${projectId}`;

  const cached = await redis.get(cacheKey);

  if (cached) {
    refreshIssuesCache(projectId).catch(console.error);

    return cached;
  }

  const fresh = await fetchFreshIssues(projectId);
  await redis.set(cacheKey, fresh, { ex: 120 });

  return fresh;
}