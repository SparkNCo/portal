import { linearClient } from "../linear/LinearClient";

type RoadmapParams = {
  initiativeId: string;
};

export async function getRoadMap({ initiativeId }: RoadmapParams) {
  const query = `
    query Projects($initiativeId: String!) {
      initiative(id: $initiativeId) {
        id
        projects(first: 5) {
          nodes {
            id
            name
            description
            progress
            priorityLabel
            targetDate
            lead {
              displayName
            }
            projectMilestones(first: 5) {
              nodes {
                id
                name
                status
                targetDate
                currentProgress
                createdAt
                issues(first: 10) {
                  nodes {
                    id
                    createdAt
                    completedAt
                    canceledAt
                    dueDate
                    estimate
                    priorityLabel
                    state {
                      name
                    }
                    assignee {
                      displayName
                    }
                    labels(last: 4) {
                      nodes {
                        name
                      }
                    }
                    cycle {
                      startsAt
                      endsAt
                      isActive
                      isPast
                      isFuture
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  `;

  const variables = { initiativeId };

  const response = await linearClient.client.request(query, variables);

  return response.initiative;
}
