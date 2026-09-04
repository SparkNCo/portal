"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronsUpDown, Film, Link as LinkIcon, Loader2 } from "lucide-react";
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
import {
  type Demo,
  type DemoGroup,
  fetchProjectDemos,
  groupDemosByContent,
} from "@/lib/demo-video-utils";

// Type-to-search picker for "select an existing demo video" — used by the
// per-ticket Demo tab (create a version, or replace one, by pointing at a
// video already uploaded somewhere else in the project) and could be reused
// anywhere else that needs to attach an already-uploaded demo.
export function DemoPicker({
  slug,
  onSelect,
  disabled,
}: {
  readonly slug: string;
  readonly onSelect: (demo: Demo) => void;
  readonly disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["project-demos", slug],
    queryFn: () => fetchProjectDemos(slug),
    enabled: open && !!slug,
  });

  const groups: DemoGroup[] = useMemo(() => {
    if (!data) return [];
    const issueTitleById = new Map(data.issues.map((i) => [i.id, i.title]));
    return groupDemosByContent(data.demos, issueTitleById);
  }, [data]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled}
          className="gap-1.5"
        >
          <ChevronsUpDown className="h-3.5 w-3.5" />
          Select Existing
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <Command>
          <CommandInput placeholder="Search demo videos…" />
          <CommandList>
            {isLoading && (
              <div className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Loading demos…
              </div>
            )}
            {!isLoading && (
              <CommandEmpty className="py-3 px-3 text-sm text-muted-foreground">
                No demo videos in this project yet.
              </CommandEmpty>
            )}
            <CommandGroup>
              {groups.map((group) => (
                <CommandItem
                  key={group.key}
                  value={`${group.representative.file_name ?? group.representative.embed_url ?? group.key} ${group.issues.map((i) => i.title).join(" ")}`}
                  onSelect={() => {
                    onSelect(group.representative);
                    setOpen(false);
                  }}
                  className={cn("flex items-start gap-2 smalltext")}
                >
                  {group.representative.source_type === "upload" ? (
                    <Film className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
                  ) : (
                    <LinkIcon className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-foreground">
                      {group.representative.source_type === "upload"
                        ? group.representative.file_name
                        : (group.representative.embed_provider ?? "Embedded link")}
                    </p>
                    <p className="truncate text-muted-foreground">
                      Attached to {group.issues.map((i) => i.title).join(", ")}
                    </p>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
