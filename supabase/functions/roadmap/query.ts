// Kept deliberately lean: this is the query the "Projects Timeline" pulls
// on every load, and it's the most expensive one in this function since
// `first: N` at three nested levels (projects → milestones → issues)
// multiplies together — every extra field on an issue here gets paid for
// up to projects×milestones×issues times over. The timeline only ever
// derives two things from a milestone's issues (see getCycleIds in
// ProjectRow.tsx): whether it has one, and which cycle it's in. Everything
// else previously fetched per issue (title, assignee, labels, dates,
// estimate, etc.) — and per project (description, dates, progress, lead,
// etc., none of which components/roadmap reads) — was dead weight that
// existed only because CYCLE_ISSUES_QUERY/PROJECT_ISSUES_QUERY below
// (fetched separately, on demand, when a cycle/milestone/project is
// actually clicked) need those fields and this query didn't need its own
// copy. Trimming it is what makes room to raise `projects(first: ...)`
// above the 5 it was previously capped at without tripping Linear's query
// complexity limit — if that number ever needs to go higher still, cutting
// `issues(first: 25)` per milestone is the next biggest lever, at the cost
// of possibly missing a cycle a milestone's 26th+ issue belongs to.
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
          color
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

// Fetched when a project header is clicked directly (no cycle or milestone
// selected) — every issue in the project across every cycle, same field
// shape as CYCLE_ISSUES_QUERY/MILESTONE_ISSUES_QUERY so the results panel
// doesn't need to branch on where they came from.
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
