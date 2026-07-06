// @ts-nocheck
import { LINEAR_GRAPHQL } from "../utils/headers.ts";

const INITIATIVE_PROJECTS_QUERY = `
  query InitiativeProjects($initiativeId: String!) {
    initiative(id: $initiativeId) {
      projects(first: 50) {
        nodes {
          id
        }
      }
    }
  }
`;

const PROJECT_ISSUE_ATTACHMENTS_QUERY = `
  query ProjectIssueAttachments($projectId: String!) {
    project(id: $projectId) {
      issues(first: 20) {
        nodes {
          attachments(first: 10) {
            nodes { url }
          }
        }
      }
    }
  }
`;

const GITHUB_REPO_REGEX = /github\.com\/([^/]+)\/([^/]+)/;

async function linearGraphQL(query: string, variables: Record<string, unknown>) {
  const res = await fetch(LINEAR_GRAPHQL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: Deno.env.get("LINEAR_API_KEY")!,
    },
    body: JSON.stringify({ query, variables }),
  });

  const json = await res.json();

  if (json.errors) {
    throw new Error(`Linear API error: ${json.errors[0]?.message}`);
  }

  return json.data;
}

// Looks at a project's issue attachments for a linked GitHub issue/PR and
// derives the GitHub repo URL from it (e.g. ".../issues/171" -> repo root).
async function fetchGithubRepoUrlForProject(projectId: string): Promise<string | null> {
  const data = await linearGraphQL(PROJECT_ISSUE_ATTACHMENTS_QUERY, { projectId });

  const issues = data?.project?.issues?.nodes ?? [];
  for (const issue of issues) {
    for (const attachment of issue.attachments?.nodes ?? []) {
      const match = GITHUB_REPO_REGEX.exec(attachment.url ?? "");
      if (match) return `https://github.com/${match[1]}/${match[2]}`;
    }
  }

  return null;
}

// Fetches the Linear projects belonging to an initiative, along with the
// GitHub repo URLs derived from those projects' issue attachments.
export async function fetchProjectUrlsFromLinear(
  initiativeId: string,
): Promise<{ linearProjects: string[]; projectUrls: string[] }> {
  const data = await linearGraphQL(INITIATIVE_PROJECTS_QUERY, { initiativeId });

  const projects = data?.initiative?.projects?.nodes ?? [];
  const linearProjects: string[] = projects.map((p: any) => p.id);

  const projectUrls = new Set<string>();
  for (const projectId of linearProjects) {
    const repoUrl = await fetchGithubRepoUrlForProject(projectId);
    if (repoUrl) projectUrls.add(repoUrl);
  }

  return { linearProjects, projectUrls: [...projectUrls] };
}
