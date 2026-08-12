"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/components/ui/button";
import { cn } from "@/lib/utils";
import { API_HEADERS } from "@/lib/api-headers";
import type { Test } from "@/components/client/issues.types";

async function searchTests(projectSlug: string, query: string): Promise<Test[]> {
  const params = new URLSearchParams({ project_slug: projectSlug });
  if (query.trim()) params.set("q", query.trim());
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/tests?${params.toString()}`,
    { headers: API_HEADERS },
  );
  if (!res.ok) return [];
  return res.json();
}

// Type-to-search combobox for the "add test case" flow: search existing tests (scoped
// to the current customer/initiative) as you type, pick one to reuse, or fall through
// to creating a brand new test with that name.
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
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open) return;
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
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search or name a new test…"
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            {!loading && (
              <CommandEmpty className="py-3 smalltext text-muted-foreground">
                No matching tests.
              </CommandEmpty>
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
                    className="smalltext"
                  >
                    <Check className="h-3.5 w-3.5 opacity-0" />
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
                className={cn("smalltext text-popover-foreground", !query.trim() && "opacity-50")}
                disabled={!query.trim()}
              >
                <Plus className="h-3.5 w-3.5" />
                <span className="truncate">
                  {query.trim() ? `Create new test "${query.trim()}"` : "Type a name to create a new test"}
                </span>
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
