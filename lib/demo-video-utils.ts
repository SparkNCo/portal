import { fetchIssues } from "@/app/[slug]/(portal)/dashboard/page";
import { API_HEADERS } from "@/lib/api-headers";
import type { Issue } from "@/components/client/issues.types";

// Shared between the per-ticket Demo tab (components/client/demo-tab.tsx)
// and the developer-wide Demos page (app/dev/demos/page.tsx) — both render
// the same `demo_videos` rows, just scoped differently (one issue vs. every
// issue in a project).

export type DemoUser = {
  id: string;
  email: string;
  userName?: string | null;
  role?: string;
};

export type Demo = {
  id: string;
  issue_id: string;
  version: number;
  source_type: "upload" | "embed";
  file_name: string | null;
  file_url: string | null;
  storage_path: string | null;
  embed_url: string | null;
  embed_provider: string | null;
  created_at: string;
  updated_at?: string;
  uploader?: DemoUser | null;
};

const IMAGE_EXTENSIONS = /\.(png|jpe?g|webp|gif)$/i;

export function isImageFile(fileName?: string | null) {
  return !!fileName && IMAGE_EXTENSIONS.test(fileName);
}

export function getEmbedIframeSrc(embedUrl: string, provider?: string | null) {
  if (provider === "loom") {
    const match = embedUrl.match(/loom\.com\/share\/([a-zA-Z0-9]+)/);
    if (match) return `https://www.loom.com/embed/${match[1]}`;
  }
  return embedUrl;
}

export function displayName(user?: DemoUser | null) {
  if (!user) return "Someone";
  return user.userName || user.email;
}

// Several `demo_videos` rows (one per issue they're attached to) can point
// at the exact same uploaded file or embed link — "select an existing demo
// video" is what creates that sharing. This key identifies "the same demo
// content" regardless of which issue/version row it's attached to.
export function demoContentKey(demo: Demo): string {
  return demo.source_type === "upload"
    ? `upload:${demo.storage_path}`
    : `embed:${demo.embed_url}`;
}

export type DemoGroup = {
  key: string;
  // Most-recently-created row sharing this content — used for preview/
  // playback and as the `source_demo_id` when attaching this same content
  // elsewhere.
  representative: Demo;
  issues: { id: string; title: string }[];
};

// Collapses per-issue demo_videos rows down to one entry per distinct piece
// of content (see demoContentKey), each carrying every issue it's attached
// to — used by both the Demos sidebar list and the "select an existing
// demo" picker so the same upload/link doesn't show up once per ticket.
export function groupDemosByContent(
  demos: Demo[],
  issueTitleById: Map<string, string>,
): DemoGroup[] {
  const groups = new Map<string, DemoGroup>();

  for (const demo of demos) {
    const key = demoContentKey(demo);
    const issueEntry = {
      id: demo.issue_id,
      title: issueTitleById.get(demo.issue_id) ?? demo.issue_id,
    };
    const existing = groups.get(key);

    if (!existing) {
      groups.set(key, { key, representative: demo, issues: [issueEntry] });
      continue;
    }

    if (!existing.issues.some((i) => i.id === issueEntry.id)) {
      existing.issues.push(issueEntry);
    }
    if (new Date(demo.created_at) > new Date(existing.representative.created_at)) {
      existing.representative = demo;
    }
  }

  return Array.from(groups.values()).sort(
    (a, b) =>
      new Date(b.representative.created_at).getTime() -
      new Date(a.representative.created_at).getTime(),
  );
}

// All demo videos across every issue in a project, plus the full issue list
// (so the Demos page can render the exact same IssueCard/PriorityTasks the
// rest of the developer dashboard uses). `demo_videos` has no project/slug
// column of its own, so this resolves the project's issues from Linear
// first (same `fetchIssues` every other developer page uses) and asks the
// demo-videos function for just those issue ids.
export async function fetchProjectDemos(slug: string): Promise<{
  demos: Demo[];
  issues: Issue[];
}> {
  const issues: Issue[] = ((await fetchIssues(slug)) ?? []).filter(
    (i: any) => i?.id,
  );

  if (issues.length === 0) return { demos: [], issues: [] };

  const params = new URLSearchParams({
    issue_ids: issues.map((i) => i.id).join(","),
  });
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/demo-videos?${params.toString()}`,
    { headers: API_HEADERS },
  );
  if (!res.ok) throw new Error("Failed to load demo videos");

  return { demos: (await res.json()) as Demo[], issues };
}
