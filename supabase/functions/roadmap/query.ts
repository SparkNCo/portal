export const PROJECTS_QUERY = `
query Projects($initiativeId: String!) {
  initiative(id: $initiativeId) {
    id
    projects(first: 5) {
      nodes {
        id
        name
        targetDate
        createdAt
        currentProgress
        description
        startDate
        startedAt
        progress
        progressHistory
        priorityLabel
        prioritySortOrder
        content
        projectMilestones(first: 5) {
          nodes {
            id
            description
            issues(first: 25) {
              nodes {
                cycle {
                  endsAt
                  startsAt
                  isActive
                  isPast
                  isFuture
                  id
                  name
                  number
                }
                assignee {
                  displayName
                }
                createdAt
                completedAt
                canceledAt
                creator {
                  displayName
                }
                dueDate
                estimate
                priorityLabel
                labels(last: 4) {
                  nodes {
                    name
                  }
                }
                state {
                  name
                }
                id
                title
                identifier
                description
              }
              pageInfo {
                hasNextPage
                endCursor
              }
            }
            status
            targetDate
            currentProgress
            createdAt
            name
            progress
            progressHistory
          }
        }
        status {
          name
          position
        }
        lead {
          displayName
        }
      }
    }
  }
}
`;

// Cycles belong to a team, not a project, so getting the full cycle list is
// two hops: find the project's team, then that team's cycles. Kept separate
// from PROJECTS_QUERY (rather than nested) so it only has to run once per
// team instead of once per project.
export const PROJECT_TEAM_QUERY = `
query GetProjectTeam($projectId: String!) {
  project(id: $projectId) {
    id
    name
    teams {
      nodes {
        id
        name
      }
    }
  }
}
`;

export const TEAM_CYCLES_QUERY = `
query GetTeamCycles($teamId: String!) {
  team(id: $teamId) {
    id
    name
    cycles(first: 100) {
      nodes {
        id
        number
        name
        startsAt
        endsAt
        isActive
        isPast
        isFuture
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
}
`;

// Fetched on demand when a cycle block is clicked — gives the real, complete
// set of issues in that cycle (team-wide), rather than whatever happened to
// already be loaded via project milestones. `$filter` narrows it down to a
// single project and/or milestone when the click came from a specific row
// instead of the collapsed per-project summary.
export const CYCLE_ISSUES_QUERY = `
query CycleIssues($cycleId: String!, $after: String, $filter: IssueFilter) {
  cycle(id: $cycleId) {
    id
    number
    issues(first: 25, after: $after, filter: $filter) {
      nodes {
        id
        identifier
        title
        description
        priorityLabel
        estimate
        dueDate
        completedAt
        canceledAt
        createdAt
        state {
          name
        }
        assignee {
          displayName
        }
        creator {
          displayName
        }
        labels(last: 4) {
          nodes {
            name
          }
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

// Fetched when a project header is clicked directly (no cycle selected) —
// every issue in the project across every cycle, same field shape as
// CYCLE_ISSUES_QUERY so the results panel doesn't need to branch on where
// they came from.
export const PROJECT_ISSUES_QUERY = `
query ProjectIssues($projectId: String!, $after: String) {
  project(id: $projectId) {
    id
    issues(first: 25, after: $after) {
      nodes {
        id
        identifier
        title
        description
        priorityLabel
        estimate
        dueDate
        completedAt
        canceledAt
        createdAt
        state {
          name
        }
        assignee {
          displayName
        }
        creator {
          displayName
        }
        labels(last: 4) {
          nodes {
            name
          }
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

// Fetched when a milestone is clicked directly (no cycle selected) — every
// issue in that milestone across every cycle it spans.
export const MILESTONE_ISSUES_QUERY = `
query MilestoneIssues($milestoneId: String!, $after: String) {
  projectMilestone(id: $milestoneId) {
    id
    issues(first: 25, after: $after) {
      nodes {
        id
        identifier
        title
        description
        priorityLabel
        estimate
        dueDate
        completedAt
        canceledAt
        createdAt
        state {
          name
        }
        assignee {
          displayName
        }
        creator {
          displayName
        }
        labels(last: 4) {
          nodes {
            name
          }
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
