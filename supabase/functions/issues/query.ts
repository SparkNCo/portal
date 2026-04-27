export const ISSUES_QUERY = `
query Issues($filter: IssueFilter) {
  issues(first: 100, filter: $filter) {
    nodes {
      state { name }
      cycle {
        endsAt
        startsAt
        isActive
        isPast
        isFuture
        number
      }
      title
      url
      id
      updatedAt
      description
      activitySummary
      assignee { displayName }
      branchName
      createdAt
      completedAt
      canceledAt
      comments(last: 5) {
        nodes {
          bodyData
          createdAt
          editedAt
          resolvedAt
          user { displayName }
        }
      }
      creator { displayName }
      documents(last: 5) {
        nodes {
          url
          title
        }
      }
      dueDate
      estimate
      priorityLabel
      prioritySortOrder
      number
      labels(last: 4) {
        nodes { name }
      }
    }
  }
}
`;