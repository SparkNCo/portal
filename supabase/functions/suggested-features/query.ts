// AI context for ONE project of a customer: the customer's initiative (what
// the whole product is), the project itself (its short description and its
// longer content), whether it's still open, its milestones (so the AI can
// pick one) and its tickets with their status type (so it knows what's done,
// what's open and what was dropped, and avoids suggesting any of them).
// Per project, not per initiative, to keep the prompt focused and Linear's
// query complexity low.
export const PROJECT_CONTEXT_QUERY = `
query ProjectContext($projectId: String!, $initiativeId: String!) {
  initiative(id: $initiativeId) {
    name
    description
  }
  project(id: $projectId) {
    id
    name
    description
    content
    completedAt
    canceledAt
    status { type }
    projectMilestones(first: 20) {
      nodes {
        id
        name
        description
        status
      }
    }
    issues(first: 100) {
      nodes {
        title
        priorityLabel
        state {
          name
          type
        }
        projectMilestone {
          id
        }
      }
    }
  }
}
`;
