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
            description
            issues(first: 10) {
              nodes {
                cycle {
                  endsAt
                  startsAt
                  isActive
                  isPast
                  isFuture
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