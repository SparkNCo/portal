// AI context for ONE project: milestones (so it can pick one) and issues (so it
// avoids duplicates). Per project, not per initiative, to keep the prompt
// focused and Linear's query complexity low.
export const PROJECT_CONTEXT_QUERY = `
query ProjectContext($projectId: String!) {
  project(id: $projectId) {
    id
    name
    description
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
        }
        projectMilestone {
          id
        }
      }
    }
  }
}
`;
