// @ts-nocheck

export const PROJECTS_LIGHT_QUERY = `
query Projects($initiativeId: String!) {
  initiative(id: $initiativeId) {
    id
    name
    projects(first: 5) {
      nodes {
        id
        name
        projectMilestones(first: 5) {
          nodes {
            id
            name
            status
          }
        }
      }
    }
  }
}
`;

export const ISSUES_BY_MILESTONE_QUERY = `
query IssuesByMilestone($milestoneId: ID!) {
  issues(filter: { projectMilestone: { id: { eq: $milestoneId } } }) {
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
`;
