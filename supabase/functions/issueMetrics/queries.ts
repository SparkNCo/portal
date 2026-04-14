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
        teams {
          nodes {
            id
          }
        }
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

export const CYCLES_BY_TEAM_QUERY = `
query CyclesByTeam($teamId: ID!) {
  cycles(filter: { team: { id: { eq: $teamId } } }) {
    nodes {
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
          id
          title
          number
          priority
          dueDate
        }
      }
    }
  }
}
`;

export const GET_PROJECT_QUERY = `
query GetProject($projectId: String!) {
  project(id: $projectId) {
    id
    name
    description
    progress
    startDate
    targetDate
    lead {
      displayName
    }
    slugId
    status {
      id
      name
      type
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
