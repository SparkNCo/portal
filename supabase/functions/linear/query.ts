export const USERS_LIST_QUERY = `
query Users {
  users(first: 50) {
    nodes {
      id
      name
      displayName
      email
      avatarUrl
      active
      createdAt
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}
`;
export const USER_PROJECTS_QUERY = `
query UsersData($userId: String!) {
  user(id: $userId) {
    teams {
      nodes {
        projects(first: 10)  {
          nodes {
            id
            name
            initiatives(first: 5)  {
              nodes {
                id
                name
              }
            }
          }
        }
      }
    }
  }
}
`;

export const PROJECTS_BY_IDS_QUERY = `
query ProjectsByIds($projectIds: [ID!]!) {
  projects(
    filter: { id: { in: $projectIds } }
    first: 10
  ) {
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
          status
          targetDate
          currentProgress
          createdAt
          name
          progress
          progressHistory

          issues(first: 10) {
            nodes {
              id
              createdAt
              completedAt
              canceledAt
              dueDate
              estimate
              priorityLabel

              cycle {
                startsAt
                endsAt
                isActive
                isPast
                isFuture
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

              state {
                name
              }
            }
          }
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
`;

