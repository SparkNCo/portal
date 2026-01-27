import { redis } from "@/lib/redis/redis";
import { linearClient } from "../linear/LinearClient";

type RoadmapParams = {
  initiativeId: string;
};

async function fetchFreshRoadmap(initiativeId: string) {
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
async function refreshRoadmapCache(initiativeId: string) {
  const fresh = await fetchFreshRoadmap(initiativeId);
  await redis.set(`roadmap:${initiativeId}`, fresh, { ex: 120 });
}


export async function getRoadMap({ initiativeId }: RoadmapParams) {
  const cacheKey = `roadmap:${initiativeId}`;

  const cached = await redis.get(cacheKey);

  if (cached) {
    console.log("🚀 returning CACHE");
    refreshRoadmapCache(initiativeId).catch(console.error);

    return cached;
  }

  // ❌ No cache → fetch immediately
  const fresh = await fetchFreshRoadmap(initiativeId);
  await redis.set(cacheKey, fresh, { ex: 120 });

  console.log("📡 returning FRESH DATA");
  return fresh;
}