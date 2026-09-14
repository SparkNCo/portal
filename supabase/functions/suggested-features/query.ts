// Everything the AI call needs to reason about ONE project: its own name/
// description, every milestone it has (so the AI can pick one), and its
// issues' titles/status/priority (so the AI can avoid suggesting something
// that already exists and can gauge what's already been built).
//
// Deliberately scoped to a single project (called once per project, per the
// "run method once for each project" requirement) rather than the whole
// initiative at once — keeps the prompt focused and avoids the same query-
// complexity blowup that made roadmap/query.ts's PROJECTS_QUERY expensive
// when it tried to cover every project's every issue in one shot.
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
