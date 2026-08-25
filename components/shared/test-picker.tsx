"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronsUpDown, Loader2, Plus, Sparkles } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/components/ui/button";
import { cn } from "@/lib/utils";
import { API_HEADERS } from "@/lib/api-headers";
import type { Test } from "@/components/client/issues.types";

type SimilarTestMatch = {
  id: string;
  score: number;
  metadata?: { test_id?: string; name?: string };
};

// The semantic search needs real text to match against — too short and it's
// just noise, same reasoning as the "similar issue" hint on Request a Feature.
const MIN_QUERY_LENGTH = 10;
const SIMILARITY_THRESHOLD = 0.7;
// Long on purpose — every firing is an Upstash query, so this waits for the user to
// actually pause typing rather than re-querying on every short break in typing.
const SIMILAR_DEBOUNCE_MS = 3000;

async function fetchSimilarTests(
  projectSlug: string,
  query: string,
): Promise<SimilarTestMatch[]> {
  const params = new URLSearchParams({ project_slug: projectSlug, q: query });
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/tests/similar?${params.toString()}`,
    { headers: API_HEADERS },
  );
  if (!res.ok) return [];
  return res.json();
}

// Resolves a semantic match (which only carries {test_id, name} metadata) into the
// full Test row needed by onSelectExisting.
async function fetchTestById(
  projectSlug: string,
  id: string,
): Promise<Test | null> {
  const params = new URLSearchParams({ project_slug: projectSlug, id });
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/tests?${params.toString()}`,
    { headers: API_HEADERS },
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data[0] ?? null;
}

// Type-to-search combobox for the "add test case" flow: once there's enough typed
// text, surfaces semantically similar existing tests (Upstash) to reuse, or falls
// through to creating a brand new test with that name.
export function TestPicker({
  projectSlug,
  onSelectExisting,
  onCreateNew,
  onSelectAttached,
  attachedTestIds,
}: {
  readonly projectSlug: string;
  readonly onSelectExisting: (test: Test) => void;
  readonly onCreateNew: (title: string) => void;
  // Called instead of onSelectExisting when the picked match is already
  // attached to this ticket — the caller uses it to jump straight into
  // editing that ticket's existing test case rather than trying to attach
  // it again (which would violate one-instance-per-ticket).
  readonly onSelectAttached?: (testId: string) => void;
  // Test cases already attached to this ticket — still shown in the search
  // results (so the user can see why a near-duplicate already exists), but
  // tagged "(implemented)" and routed to onSelectAttached instead of
  // onSelectExisting so the same test can't be added twice to the same
  // ticket (it can still be reused across other tickets).
  readonly attachedTestIds?: Set<string>;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [similarResults, setSimilarResults] = useState<SimilarTestMatch[]>([]);
  const [searchingSimilar, setSearchingSimilar] = useState(false);
  const [selectingSimilarId, setSelectingSimilarId] = useState<string | null>(
    null,
  );
  const similarDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open || query.trim().length < MIN_QUERY_LENGTH) {
      setSimilarResults([]);
      setSearchingSimilar(false);
      return;
    }
    // Mark as searching (and drop any stale matches from a previous query) as soon as
    // the debounce is scheduled, not just once it fires — otherwise the old results
    // stay on screen for the full 3s wait, looking like an instant, un-debounced search.
    setSimilarResults([]);
    setSearchingSimilar(true);
    if (similarDebounceRef.current) clearTimeout(similarDebounceRef.current);
    similarDebounceRef.current = setTimeout(async () => {
      const matches = await fetchSimilarTests(projectSlug, query.trim());
      const passing = matches.filter((m) => m.score >= SIMILARITY_THRESHOLD);
      console.log("[TestPicker] similar tests", {
        query: query.trim(),
        threshold: SIMILARITY_THRESHOLD,
        all: matches.map((m) => ({ name: m.metadata?.name, test_id: m.metadata?.test_id, score: m.score })),
        passing: passing.map((m) => ({ name: m.metadata?.name, test_id: m.metadata?.test_id, score: m.score })),
      });
      setSimilarResults(passing);
      setSearchingSimilar(false);
    }, SIMILAR_DEBOUNCE_MS);
    return () => {
      if (similarDebounceRef.current) clearTimeout(similarDebounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, open, projectSlug]);

  // Tests already attached to this ticket stay visible (so the user can see
  // why a near-duplicate they're about to create already exists), tagged
  // "(implemented)" and routed to onSelectAttached (edit) instead of
  // onSelectExisting (attach) when clicked.
  const isAttached = (testId: string) => !!attachedTestIds?.has(testId);

  // Once there's enough text to have actually checked for similar tests, the
  // user can't just create a new one — either the check is still running, or
  // it already found something to reuse (or, if already attached, to edit)
  // instead, per the ticket: "only one instance of each test case per ticket
  // max". Below the min length, no check has run yet, so creating stays
  // blocked rather than let someone dodge the check with a too-short query.
  const belowMinLength = query.trim().length < MIN_QUERY_LENGTH;
  const mustPickExisting = !belowMinLength && (searchingSimilar || similarResults.length > 0);
  const createDisabled = !query.trim() || belowMinLength || mustPickExisting;

  async function handleSelectSimilar(match: SimilarTestMatch) {
    const testId = match.metadata?.test_id;
    if (!testId) return;

    if (isAttached(testId)) {
      onSelectAttached?.(testId);
      setOpen(false);
      setQuery("");
      return;
    }

    setSelectingSimilarId(match.id);
    const test = await fetchTestById(projectSlug, testId);
    setSelectingSimilarId(null);
    if (test) {
      onSelectExisting(test);
      setOpen(false);
      setQuery("");
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="w-full justify-between smalltext"
        >
          + Add test case
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] p-0"
        align="start"
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search or name a new test…"
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            {query.trim().length < MIN_QUERY_LENGTH ? (
              <CommandEmpty className="py-3 smalltext text-muted-foreground">
                Type at least {MIN_QUERY_LENGTH} characters to search existing tests.
              </CommandEmpty>
            ) : (
              !searchingSimilar &&
              similarResults.length === 0 && (
                <CommandEmpty className="py-3 smalltext text-muted-foreground">
                  No matching tests.
                </CommandEmpty>
              )
            )}
            {searchingSimilar && (
              <div className="flex items-center gap-2 px-2 py-1.5 smalltext text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Looking for similar tests…
              </div>
            )}
            {!searchingSimilar && similarResults.length > 0 && (
              <CommandGroup heading="Similar tests">
                {similarResults.map((match) => {
                  const testId = match.metadata?.test_id;
                  const attached = !!testId && isAttached(testId);
                  return (
                    <CommandItem
                      key={match.id}
                      value={`similar-${match.id}`}
                      // Not `disabled` on purpose — that sets pointer-events-none via
                      // CommandItem's base classes, which would silently block hover
                      // too, so the tooltip below would never fire. An attached test
                      // routes to onSelectAttached (edit) instead of being inert.
                      onSelect={() => handleSelectSimilar(match)}
                      title={attached ? "Already attached to this ticket — click to edit" : undefined}
                      className={cn(
                        "smalltext",
                        attached
                          ? "text-muted-foreground data-[selected=true]:text-muted-foreground"
                          : "text-black data-[selected=true]:text-primary",
                      )}
                    >
                      {selectingSimilarId === match.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Sparkles className={cn("h-3.5 w-3.5", attached ? "text-muted-foreground" : "text-primary")} />
                      )}
                      <span className="truncate">
                        {match.metadata?.name ?? "Untitled test"}
                        {attached && (
                          <span className="text-muted-foreground"> (implemented)</span>
                        )}
                      </span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}
            <CommandGroup>
              <CommandItem
                value={`__create__${query}`}
                onSelect={() => {
                  if (createDisabled) return;
                  onCreateNew(query.trim());
                  setOpen(false);
                  setQuery("");
                }}
                className={cn(
                  "smalltext text-popover-foreground data-[selected=true]:text-primary",
                  createDisabled && "opacity-50",
                )}
                disabled={createDisabled}
              >
                <Plus className="h-3.5 w-3.5" />
                <span className="truncate">
                  {(() => {
                    if (!query.trim()) return "Type a name to create a new test";
                    if (belowMinLength) {
                      return `Type at least ${MIN_QUERY_LENGTH} characters to check for similar tests first`;
                    }
                    if (searchingSimilar) return "Checking for similar tests…";
                    if (mustPickExisting) return "Select or edit a similar test above";
                    return `Create new test "${query.trim()}"`;
                  })()}
                </span>
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
