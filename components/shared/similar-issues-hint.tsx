"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { API_HEADERS } from "@/lib/api-headers";
import { EditIssueModal } from "@/components/build/edit-issue-modal";
import type { Issue } from "@/components/client/issues.types";

type SimilarIssueMatch = {
  id: string;
  score: number;
  metadata?: { ticket_id?: string; title?: string };
};

// Don't bother querying on very short/partial titles — too little text for the
// embedding to be meaningful, and it'd just be noise while the user is still typing.
const MIN_QUERY_LENGTH = 12;
const DEBOUNCE_MS = 400;

// Cosine similarity threshold for surfacing a match. Calibrated empirically against
// the live index: an exact-duplicate title only scored ~0.858 (the stored vector is
// title+description combined, so title-only queries never approach 1.0), and close
// paraphrases landed around ~0.74-0.76 — 0.86 never fired even on real duplicates.
const SIMILARITY_THRESHOLD = 0.7;

async function fetchSimilarIssues(slug: string, query: string): Promise<SimilarIssueMatch[]> {
  const params = new URLSearchParams({ slug, q: query });
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
}: {
  readonly slug: string;
  readonly query: string;
}) {
  const [matches, setMatches] = useState<SimilarIssueMatch[]>([]);
  const [dismissed, setDismissed] = useState(false);
  const [loadingMatchId, setLoadingMatchId] = useState<string | null>(null);
  const [editingIssue, setEditingIssue] = useState<Issue | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setDismissed(false);

    if (query.trim().length < MIN_QUERY_LENGTH) {
      setMatches([]);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const results = await fetchSimilarIssues(slug, query.trim());
      setMatches(results.filter((m) => m.score >= SIMILARITY_THRESHOLD));
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [slug, query]);

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
      {!dismissed && matches.length > 0 && (
        <div className="flex items-start justify-between gap-2 rounded-md border border-border bg-secondary px-3 py-2 smalltext">
          <div className="space-y-1.5 min-w-0 flex-1">
            <p className="text-muted-foreground">Similar to an existing ticket:</p>
            <ul className="space-y-1">
              {matches.slice(0, 3).map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-2 min-w-0">
                  <span className="truncate text-card-foreground">
                    {m.metadata?.title ?? m.id}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleEditInstead(m)}
                    disabled={loadingMatchId === m.id}
                    className="shrink-0 text-primary hover:underline disabled:opacity-50"
                  >
                    {loadingMatchId === m.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      "Edit this instead"
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => setDismissed(true)}
            className="shrink-0 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
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
