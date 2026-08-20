"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronsUpDown, Diamond, Loader2, Plus, Sparkles } from "lucide-react";
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

// Both the plain and semantic search need real text to match against — too short and
// it's just noise, same reasoning as the "similar issue" hint on Request a Feature.
const MIN_QUERY_LENGTH = 10;
const SIMILARITY_THRESHOLD = 0.7;
// Long on purpose — every firing is an Upstash query, so this waits for the user to
// actually pause typing rather than re-querying on every short break in typing.
const SIMILAR_DEBOUNCE_MS = 3000;

async function searchTests(
  projectSlug: string,
  query: string,
): Promise<Test[]> {
  const params = new URLSearchParams({ project_slug: projectSlug });
  if (query.trim()) params.set("q", query.trim());
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/tests?${params.toString()}`,
    { headers: API_HEADERS },
  );
  if (!res.ok) return [];
  return res.json();
}

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

// Type-to-search combobox for the "add test case" flow: search existing tests (scoped
// to the current customer/initiative) as you type, pick one to reuse, or fall through
// to creating a brand new test with that name. Once there's enough typed text, also
// surfaces semantically similar tests (Upstash) alongside the plain ILIKE list — a
// wording mismatch that ILIKE would miss (e.g. "login" vs "sign in") can still turn up.
export function TestPicker({
  projectSlug,
  onSelectExisting,
  onCreateNew,
}: {
  readonly projectSlug: string;
  readonly onSelectExisting: (test: Test) => void;
  readonly onCreateNew: (title: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Test[]>([]);
  const [loading, setLoading] = useState(false);
  const [similarResults, setSimilarResults] = useState<SimilarTestMatch[]>([]);
  const [searchingSimilar, setSearchingSimilar] = useState(false);
  const [selectingSimilarId, setSelectingSimilarId] = useState<string | null>(
    null,
  );
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const similarDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open || query.trim().length < MIN_QUERY_LENGTH) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const data = await searchTests(projectSlug, query);
      setResults(data);
      setLoading(false);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, open, projectSlug]);

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
      setSimilarResults(matches.filter((m) => m.score >= SIMILARITY_THRESHOLD));
      setSearchingSimilar(false);
    }, SIMILAR_DEBOUNCE_MS);
    return () => {
      if (similarDebounceRef.current) clearTimeout(similarDebounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, open, projectSlug]);

  // Don't repeat a test that's already showing in the plain ILIKE list below.
  const resultIds = new Set(results.map((t) => t.id));
  const visibleSimilar = similarResults.filter(
    (m) => m.metadata?.test_id && !resultIds.has(m.metadata.test_id),
  );

  async function handleSelectSimilar(match: SimilarTestMatch) {
    const testId = match.metadata?.test_id;
    if (!testId) return;
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
              !loading && (
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
            {!searchingSimilar && visibleSimilar.length > 0 && (
              <CommandGroup heading="Similar tests">
                {visibleSimilar.map((match) => (
                  <CommandItem
                    key={match.id}
                    value={`similar-${match.id}`}
                    onSelect={() => handleSelectSimilar(match)}
                    className="smalltext text-black data-[selected=true]:text-primary"
                  >
                    {selectingSimilarId === match.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5 text-primary" />
                    )}
                    <span className="truncate">
                      {match.metadata?.name ?? "Untitled test"}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {results.length > 0 && (
              <CommandGroup heading="Existing tests">
                {results.map((test) => (
                  <CommandItem
                    key={test.id}
                    value={test.id}
                    onSelect={() => {
                      onSelectExisting(test);
                      setOpen(false);
                      setQuery("");
                    }}
                    className="smalltext text-black data-[selected=true]:text-primary"
                  >
                    <Diamond className="h-3.5 w-3.5" />
                    <span className="truncate">{test.title}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            <CommandGroup>
              <CommandItem
                value={`__create__${query}`}
                onSelect={() => {
                  onCreateNew(query.trim());
                  setOpen(false);
                  setQuery("");
                }}
                className={cn(
                  "smalltext text-popover-foreground data-[selected=true]:text-primary",
                  !query.trim() && "opacity-50",
                )}
                disabled={!query.trim()}
              >
                <Plus className="h-3.5 w-3.5" />
                <span className="truncate">
                  {query.trim()
                    ? `Create new test "${query.trim()}"`
                    : "Type a name to create a new test"}
                </span>
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
