// @ts-nocheck
import { corsHeaders } from "../utils/headers.ts";

const ERROR_SIGNALS = ["revert", "hotfix", "rollback", "bugfix"];

function parseRepo(repoUrl: string): string {
  const match = repoUrl.match(
    /github\.com\/([^/]+\/[^/]+?)(?:\.git)?(?:\/.*)?$/,
  );
  if (match) return match[1];
  if (/^[\w.-]+\/[\w.-]+$/.test(repoUrl)) return repoUrl;
  throw new Error(`Cannot parse repo from: ${repoUrl}`);
}

// 🔥 NEW: check CI status of commit
async function getCIStatus(repo: string, sha: string, token: string) {
  const res = await fetch(
    `https://api.github.com/repos/${repo}/commits/${sha}/status`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
      },
    },
  );

  if (!res.ok) return "unknown";

  const data = await res.json();
  return data.state; 
}

async function fetchMergedPRs(repo: string, token: string, limit: number) {
  const merges = [];
  let page = 1;
  const perPage = 20; 

  while (merges.length < limit) {
    const url = `https://api.github.com/repos/${repo}/pulls?state=closed&base=main&per_page=${perPage}&page=${page}`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`GitHub API error ${res.status}: ${body}`);
    }

    const prs: any[] = await res.json();
    if (!prs.length) break;

    for (const pr of prs) {
      if (!pr.merged_at) continue;

      const titleLower = pr.title.toLowerCase().trim();
      const labelNames: string[] =
        pr.labels?.map((l: any) => l.name.toLowerCase()) ?? [];

      const hasError = ERROR_SIGNALS.some(
        (kw) =>
          titleLower.startsWith(kw) || labelNames.some((l) => l.includes(kw)),
      );

      if (hasError) continue;

      const sha = pr.merge_commit_sha || pr.head?.sha;
      if (!sha) continue;

      const ciState = await getCIStatus(repo, sha, token);

      if (ciState !== "success") continue; 

      merges.push({
        pr_number: pr.number,
        title: pr.title,
        merged_at: pr.merged_at,
        merged_by: pr.merged_by?.login ?? null,
        ci_status: ciState,
        labels: labelNames,
        url: pr.html_url,
      });

      if (merges.length >= limit) break;
    }

    if (prs.length < perPage) break;
    page++;
  }

  return merges;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
    const token = Deno.env.get("GHPERSONALTOKEN");
    const repoUrl = Deno.env.get("REPO_URL");

    if (!token || !repoUrl) {
      throw new Error("Missing GHPERSONALTOKEN or REPO_URL env vars");
    }

    const { searchParams } = new URL(req.url);
    const limit = Math.min(
      parseInt(searchParams.get("limit") ?? "50", 10),
      200,
    );

    const repo = parseRepo(repoUrl);
    const merges = await fetchMergedPRs(repo, token, limit);

    return new Response(
      JSON.stringify({
        repo,
        total_deployments: merges.length,
        deployments: merges,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
