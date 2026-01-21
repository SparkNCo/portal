import { linearClient } from "../linear/LinearClient";

export async function getIssues() {
  const issuesConnection = await linearClient.issues({
    first: 100,
    filter: {
      project: {
        id: {
          in: [
            "cc38bd89-8742-4db8-a30f-745a648ce09d",
          ],
        },
      },
      // Same as your Postman query
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
            })
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
        state: issue.state?.name ?? null,
      };
    })
  );
}
