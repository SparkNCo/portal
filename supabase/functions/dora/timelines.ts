// @ts-nocheck

async function fetchIssues(repo: string, token: string, limit: number) {
  const res = await fetch(
    `https://api.github.com/repos/${repo}/issues?state=all&per_page=${Math.min(limit, 100)}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
      },
    }
  );
  if (!res.ok) return [];
  const data = await res.json();
  return data.filter((i: any) => !i.pull_request).slice(0, limit);
}

async function fetchTimeline(repo: string, token: string, issueNumber: number) {
  const res = await fetch(
    `https://api.github.com/repos/${repo}/issues/${issueNumber}/timeline`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    }
  );
  if (!res.ok) return [];
  return res.json();
}

function extractLinkedPRs(timeline: any[], repo: string) {
  const prs = [];

  for (const event of timeline) {
    if (
      event.event === "cross-referenced" &&
      event.source?.issue?.pull_request &&
      event.source?.issue?.repository?.full_name === repo
    ) {
      prs.push({
        pr_number: event.source.issue.number,
        title: event.source.issue.title,
        url: event.source.issue.html_url,
      });
    }
  }

  return prs;
}

export async function handleTimelines(repo: string, token: string, limit: number) {
  const issues = await fetchIssues(repo, token, limit);

  const results = [];

  for (const issue of issues) {
    const timeline = await fetchTimeline(repo, token, issue.number);
    const linkedPRs = extractLinkedPRs(timeline, repo);

    console.log("ISSUE", issue.number, issue.title);
    console.log("LINKED PRS", linkedPRs);

    results.push({
      issue: {
        number: issue.number,
        title: issue.title,
        created_at: issue.created_at,
      },
      linked_prs: linkedPRs,
    });
  }

  return {
    repo,
    metric: "debug_issue_timelines",
    total_issues: results.length,
    results,
  };
}
