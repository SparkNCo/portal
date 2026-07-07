// @ts-nocheck

// Cheap scan to find which cycle(s) are active for a project. Full cycle
// details (scope history, uncompleted issues, etc.) are fetched separately,
// once per unique cycle, via GET_CYCLE_DETAILS_QUERY below — embedding the
// full cycle object per-issue (as this query used to) multiplies its cost by
// every issue in the project and blows past Linear's complexity budget on
// large projects ("Query too complex", complexity ~46000 vs a 10000 limit).
export const GET_PROJECT_ACTIVE_CYCLES_QUERY = `
query GetProjectActiveCycles($projectId: String!, $after: String) {
  project(id: $projectId) {
    id
    name
    issues(first: 250, after: $after) {
      nodes {
        id
        cycle {
          id
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
query GetCycleIssues($cycleId: String!, $after: String) {
  cycle(id: $cycleId) {
    issues(first: 250, after: $after) {
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
      pageInfo {
        hasNextPage
        endCursor
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
