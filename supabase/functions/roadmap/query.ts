// Keep lean: nested `first: N` (projects → milestones → issues) multiplies
// Linear's query complexity, so every issue field is paid for many times over.
// The timeline only needs each issue's cycle (getCycleIds in ProjectRow.tsx);
// detail fields come from the on-demand queries below. To fit more projects,
// lower `issues(first: 25)` next (may miss cycles of later issues).
export const PROJECTS_QUERY = `
query Projects($initiativeId: String!, $after: String) {
  initiative(id: $initiativeId) {
    id
    projects(first: 10, after: $after) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        id
        name
        targetDate
        projectMilestones(first: 5) {
          nodes {
            id
            name
            status
            issues(first: 25) {
              nodes {
                cycle {
                  id
                }
              }
            }
          }
        }
        status {
          name
          color
        }
      }
    }
  }
}
`;

// Cycles belong to teams, not projects. Separate from PROJECTS_QUERY so it
// runs once per team, not per project.
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

// On cycle click: all issues in the cycle; `$filter` optionally narrows to a
// project and/or milestone.
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
          email
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

// On project header click: every issue in the project. Same field shape as
// the other issue queries so the results panel doesn't branch.
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
        projectMilestone {
          id
        }
        state {
          name
        }
        assignee {
          displayName
          email
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
          email
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
