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
            issues(first: 10) {
              nodes {
                cycle {
                  endsAt
                  startsAt
                  isActive
                  isPast
                  isFuture
                  id
                  name
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

// Fetches one more page of a single milestone's issues on demand — kept as
// its own narrow query (rather than raising `first` on PROJECTS_QUERY) since
// requesting a large page for every milestone of every project in one nested
// query trips Linear's "Query too complex" limit.
export const MILESTONE_ISSUES_QUERY = `
query MilestoneIssues($milestoneId: String!, $after: String) {
  projectMilestone(id: $milestoneId) {
    issues(first: 10, after: $after) {
      nodes {
        cycle {
          endsAt
          startsAt
          isActive
          isPast
          isFuture
          id
          name
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
  }
}
`;