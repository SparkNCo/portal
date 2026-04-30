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

export const GET_PROJECT_CYCLES_QUERY = `
query GetProjectCycles($projectId: String!) {
  project(id: $projectId) {
    id
    name
    issues(first: 50) {
      nodes {
        cycle {
          id
          number
        }
      }
    }
  }
}
`;

export const GET_CYCLE_DETAILS_QUERY = `
query GetCycleDetails($cycleId: String!) {
  cycle(id: $cycleId) {
    id
    name
    number
    description
    completedAt
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

// Fetch issue statuses + active cycle per page — scalar fields only to keep complexity low
export const GET_PROJECT_ISSUE_STATUSES_QUERY = `
query GetProjectIssueStatuses($projectId: String!, $after: String) {
  project(id: $projectId) {
    id
    name
    issues(first: 250, after: $after) {
      nodes {
        id
        state {
          name
        }
        cycle {
          id
          name
          number
          isActive
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
}
`;
