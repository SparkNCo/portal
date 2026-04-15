// @ts-nocheck

export const GET_PROJECT_QUERY = `
query GetProject($projectId: String!) {
  project(id: $projectId) {
    id
    name
    issues {
      nodes {
        id
        title
        estimate
        state {
          name
        }
        labels(first: 3) {
          nodes {
            name
          }
        }
        cycle {
          id
          name
          description
          completedAt
          number
          startsAt
          endsAt
          isActive
          scopeHistory
          completedScopeHistory
          uncompletedIssuesUponClose {
            nodes {
              addedToCycleAt
              dueDate
              id
              labelIds
              number
              priority
              title
            }
          }
        }
      }
    }
  }
}
`;

export const GET_CYCLE_ISSUES_QUERY = `
query GetCycleIssues($cycleId: String!) {
  cycle(id: $cycleId) {
    issues {
      nodes {
        id
        title
        estimate
        state {
          name
        }
        labels(first: 3) {
          nodes {
            name
          }
        }
        project {
          id
        }
      }
    }
  }
}
`;
