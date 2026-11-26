"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { API_HEADERS } from "@/lib/api-headers";
import { getIssueCode } from "@/lib/utils";
import { EditIssueModal } from "@/components/build/edit-issue-modal";
import { IssueDetailModal } from "@/components/client/issue-detail-modal";
import { isClosedIssue, type Issue } from "@/components/client/issues.types";

type SimilarIssueMatch = {
  id: string;
  score: number;
  metadata?: { ticket_id?: string; title?: string; kind?: "bug" | "feature" };
};

// Don't bother querying on very short/partial text — too little for the
// embedding to be meaningful, and it'd just be noise while the user is still typing.
const MIN_QUERY_LENGTH = 7;
// Every firing embeds the query and runs a vector search; 1s after they stop
// typing (in the title or the description) keeps it feeling live without a
// search per keystroke.
const DEBOUNCE_MS = 1000;
// gte-small reads ~512 tokens; the start of a long description says enough.
const MAX_QUERY_LENGTH = 1000;
const MAX_MATCHES = 3;

// Client-side safety net only: the backend already drops matches under 0.8
// (SIMILARITY_THRESHOLD in supabase/functions/issues/updateIsste.ts), so this
// never filters anything today.
const SIMILARITY_THRESHOLD = 0.7;

async function fetchSimilarIssues(
  slug: string,
  query: string,
  kind: "bug" | "feature",
): Promise<SimilarIssueMatch[]> {
  const params = new URLSearchParams({ slug, q: query, kind });
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/issues/similar?${params.toString()}`,
    { headers: API_HEADERS },
  );
  if (!res.ok) return [];
  return res.json();
}

// The vector match only carries { id, title } metadata — "Edit this instead" needs
// the full Issue shape EditIssueModal expects, fetched from Linear on demand.
async function fetchIssueById(id: string): Promise<Issue> {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/issues/by-id?id=${encodeURIComponent(id)}`,
    { headers: API_HEADERS },
  );
  if (!res.ok) throw new Error("Failed to load issue");
  return res.json();
}

// The form's text (markdown from the rich text editors) as plain words for
// the embedding: no images, link targets, HTML or markdown symbols.
export function plainSearchText(...parts: string[]): string {
  return parts
    .join("\n")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/[#*_>`~|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_QUERY_LENGTH);
}

// Non-blocking "this might already exist" nudge above the title while
// creating a Feature Request or Bug Report — backed by the issues vector
// search (pgvector), scoped to the current customer's namespace. Searches
// again as they write (title and description), shows up to three one-line
// matches so it doesn't push the form around. A match opens the ticket
// itself (the regular detail modal); its edit button (top right, open
// tickets only, same rule as the panels) leads to Edit Ticket.
export function SimilarIssuesHint({
  slug,
  query,
  kind,
}: {
  readonly slug: string;
  // Title and description together, as plain text (see plainSearchText).
  readonly query: string;
  // Scopes matches to the panel this hint is rendered on — a bug report never
  // suggests a feature request as its "similar ticket" or vice versa. Tickets
  // with neither label (no Bug/Feature label in Linear) show up on both.
  readonly kind: "bug" | "feature";
}) {
  const [matches, setMatches] = useState<SimilarIssueMatch[]>([]);
  const [matchIssues, setMatchIssues] = useState<Record<string, Issue>>({});
  const [dismissed, setDismissed] = useState(false);
  const [searching, setSearching] = useState(false);
  // A search has finished for this text (so "no matches" can be told apart
  // from "hasn't searched yet").
  const [searched, setSearched] = useState(false);
  const [loadingMatchId, setLoadingMatchId] = useState<string | null>(null);
  const [viewingIssue, setViewingIssue] = useState<Issue | null>(null);
  const [editingIssue, setEditingIssue] = useState<Issue | null>(null);
  // Only the newest search may update the list (an older, slower one could
  // land after it).
  const latestRequest = useRef(0);

  useEffect(() => {
    const text = query.trim();
    if (text.length < MIN_QUERY_LENGTH) {
      // Form cleared (or barely started): start over, hint back on.
      latestRequest.current++;
      setMatches([]);
      setSearching(false);
      setSearched(false);
      setDismissed(false);
      return;
    }
    // The current matches stay on screen while the next search waits and
    // runs, so the hint doesn't flicker or jump while they type.
    const timer = setTimeout(async () => {
      const request = ++latestRequest.current;
      setSearching(true);
      const results = await fetchSimilarIssues(slug, text, kind).catch(() => null);
      if (request !== latestRequest.current) return;
      if (results) setMatches(results.filter((m) => m.score >= SIMILARITY_THRESHOLD).slice(0, MAX_MATCHES));
      setSearching(false);
      setSearched(true);
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [slug, query, kind]);

  // The vector match only carries { id, title } — fetch the full issue for each
  // match (ticket code, status) for the row.
  useEffect(() => {
    const missing = matches.filter((m) => !matchIssues[m.id]);
    missing.forEach(async (m) => {
      try {
        const issue = await fetchIssueById(m.id);
        setMatchIssues((prev) => ({ ...prev, [m.id]: issue }));
      } catch {
        // Best-effort enrichment — the row still shows fine with just the title.
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matches]);

  async function handleOpenMatch(match: SimilarIssueMatch) {
    setLoadingMatchId(match.id);
    try {
      const issue = matchIssues[match.id] ?? (await fetchIssueById(match.id));
      setViewingIssue(issue);
    } catch {
      toast.error("Failed to load ticket. Please try again.");
    } finally {
      setLoadingMatchId(null);
    }
  }

  const showMatches = !dismissed && matches.length > 0;

  return (
    <>
      {/* One short muted line, so it doesn't push the form down. */}
      {!dismissed && searched && matches.length === 0 && (
        <p className="flex items-center gap-1.5 smalltext text-muted-foreground" role="status">
          No similar tickets found
          {searching && <Loader2 className="h-3 w-3 animate-spin" aria-label="Updating" />}
        </p>
      )}

      {showMatches && (
        <div className="rounded-md border border-warning/30 bg-warning/5 px-2 py-1.5 smalltext" role="status">
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 font-semibold">
              <AlertTriangle className="h-3.5 w-3.5 text-warning" aria-hidden="true" />
              Similar existing ticket{matches.length === 1 ? "" : "s"}
              {searching && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" aria-label="Updating" />}
            </p>
            <button
              type="button"
              aria-label="Dismiss similar tickets"
              onClick={() => setDismissed(true)}
              className="shrink-0 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <ul className="mt-1 space-y-0.5">
            {matches.map((m) => {
              const issue = matchIssues[m.id];
              const title = issue?.title ?? m.metadata?.title ?? "Loading…";
              return (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => handleOpenMatch(m)}
                    disabled={loadingMatchId === m.id}
                    title={`Open ${title}`}
                    className="flex w-full items-center gap-2 rounded px-1.5 py-0.5 text-left hover:bg-warning/10 disabled:opacity-60"
                  >
                    {issue?.branchName && (
                      <span className="shrink-0 font-mono text-muted-foreground">{getIssueCode(issue.branchName)}</span>
                    )}
                    <span className="min-w-0 flex-1 truncate font-medium text-foreground">{title}</span>
                    {issue?.state?.name && (
                      <span className="shrink-0 text-muted-foreground">{issue.state.name}</span>
                    )}
                    {loadingMatchId === m.id && <Loader2 className="h-3 w-3 shrink-0 animate-spin text-primary" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {viewingIssue && (
        <IssueDetailModal
          issue={viewingIssue}
          slug={slug}
          onClose={() => setViewingIssue(null)}
          onEdit={
            isClosedIssue(viewingIssue)
              ? undefined
              : () => {
                  setEditingIssue(viewingIssue);
                  setViewingIssue(null);
                }
          }
        />
      )}

      {editingIssue && (
        <EditIssueModal
          issue={editingIssue}
          slug={slug}
          onClose={() => setEditingIssue(null)}
        />
      )}
    </>
  );
}
