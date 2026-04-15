// @ts-nocheck

export const GET_COMPLETED_ISSUES_QUERY = `
query GetCompletedIssues($projectId: String!, $after: DateTimeOrDuration!) {
  project(id: $projectId) {
    id
    name
    issues(
      filter: { completedAt: { gte: $after } }
      first: 250
      orderBy: updatedAt
    ) {
      nodes {
        id
        createdAt
        completedAt
        state { name type }
        labels(first: 5) {
          nodes { name }
        }
      }
    }
  }
}
`;
