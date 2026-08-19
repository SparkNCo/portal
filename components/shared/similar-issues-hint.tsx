"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { API_HEADERS } from "@/lib/api-headers";
import { EditIssueModal } from "@/components/build/edit-issue-modal";
import { IssueCard } from "@/components/client/issue-cards";
import type { Issue } from "@/components/client/issues.types";

type SimilarIssueMatch = {
  id: string;
  score: number;
  metadata?: { ticket_id?: string; title?: string; kind?: "bug" | "feature" };
};

// Don't bother querying on very short/partial titles — too little text for the
// embedding to be meaningful, and it'd just be noise while the user is still typing.
const MIN_QUERY_LENGTH = 12;
// Long on purpose — every firing is an Upstash query, so this waits for the user to
// actually pause typing rather than re-querying on every short break in typing.
const DEBOUNCE_MS = 3000;

// Cosine similarity threshold for surfacing a match. Calibrated empirically against
// the live index: an exact-duplicate title only scored ~0.858 (the stored vector is
// title+description combined, so title-only queries never approach 1.0), and close
// paraphrases landed around ~0.74-0.76 — 0.86 never fired even on real duplicates.
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

// Non-blocking "this might already exist" nudge shown under the title field while
// creating a Feature Request or Bug Report — backed by the Upstash issues vector
// index, scoped to the current customer's namespace. Offers a way to edit the
// existing ticket instead of filing a near-duplicate.
export function SimilarIssuesHint({
  slug,
  query,
  kind,
}: {
  readonly slug: string;
  readonly query: string;
  // Scopes matches to the panel this hint is rendered on — a bug report never
  // suggests a feature request as its "similar ticket" or vice versa.
  readonly kind: "bug" | "feature";
}) {
  const [matches, setMatches] = useState<SimilarIssueMatch[]>([]);
  const [matchIssues, setMatchIssues] = useState<Record<string, Issue>>({});
  const [dismissed, setDismissed] = useState(false);
  const [searching, setSearching] = useState(false);
  const [loadingMatchId, setLoadingMatchId] = useState<string | null>(null);
  const [editingIssue, setEditingIssue] = useState<Issue | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setDismissed(false);

    if (query.trim().length < MIN_QUERY_LENGTH) {
      setMatches([]);
      setSearching(false);
      return;
    }

    // Mark as searching (and drop stale matches from a previous query) as soon as the
    // debounce is scheduled, not just once it fires — otherwise old matches stay on
    // screen for the full wait, looking like an instant, un-debounced search.
    setMatches([]);
    setSearching(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const results = await fetchSimilarIssues(slug, query.trim(), kind);
      setMatches(results.filter((m) => m.score >= SIMILARITY_THRESHOLD));
      setSearching(false);
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [slug, query, kind]);

  // The vector match only carries { id, title } — fetch the full issue for each
  // match (ticket code, labels) so the row can look like the rest of the app's
  // issue rows instead of a bare title.
  useEffect(() => {
    const missing = matches.slice(0, 3).filter((m) => !matchIssues[m.id]);
    if (missing.length === 0) return;
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

  async function handleEditInstead(match: SimilarIssueMatch) {
    setLoadingMatchId(match.id);
    try {
      const issue = await fetchIssueById(match.id);
      setEditingIssue(issue);
    } catch {
      toast.error("Failed to load ticket. Please try again.");
    } finally {
      setLoadingMatchId(null);
    }
  }

  return (
    <>
      {!dismissed && (searching || matches.length > 0) && (
        <div className="space-y-1.5 smalltext">
          <div className="flex items-center justify-between gap-2">
            <p className="body font-semibold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" />
              {searching ? "Looking for similar tickets…" : "Similar existing tickets"}
            </p>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => setDismissed(true)}
              className="shrink-0 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {searching ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Searching…
            </div>
          ) : (
            <div className="grid gap-2 grid-cols-[repeat(auto-fit,minmax(240px,1fr))]">
              {matches.slice(0, 3).map((m) => {
                const issue = matchIssues[m.id];
                if (!issue) {
                  // Full issue hasn't loaded yet (fetched right after matches
                  // come in) — a lightweight placeholder card avoids a layout
                  // jump once IssueCard replaces it.
                  return (
                    <div
                      key={m.id}
                      className="rounded-lg border border-border light-card p-4 animate-pulse"
                    >
                      <p className="smalltext font-medium light-card-text truncate">
                        {m.metadata?.title ?? "Loading…"}
                      </p>
                    </div>
                  );
                }
                return (
                  <div key={m.id} className="relative">
                    <IssueCard issue={issue} onOpen={() => handleEditInstead(m)} lightCard />
                    {loadingMatchId === m.id && (
                      <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-background/60">
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
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
