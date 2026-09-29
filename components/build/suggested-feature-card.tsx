"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Lightbulb, Loader2, Maximize2, X } from "lucide-react";
import { Button } from "@/components/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { priorityColors } from "@/components/client/issues.types";
import { fetchMilestones, fetchProjects } from "@/lib/issues-api";
import {
  acceptSuggestedFeature,
  declineSuggestedFeature,
  updateSuggestionMilestone,
  updateSuggestionProject,
  type SuggestedFeature,
} from "@/lib/suggested-features-api";

// Ticket: "To accept, instead of clicking accept, select a priority" — so
// Accept isn't a single click, it opens this popover and the priority pick
// itself is what triggers the mutation.
const PRIORITY_OPTIONS: { value: "urgent" | "high" | "medium" | "low"; label: keyof typeof priorityColors }[] = [
  { value: "urgent", label: "Urgent" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

// Shared shell for the project/milestone badge pickers below — same trigger
// (a clickable Badge, no dropdown chevron, hover just tints the text orange
// instead of filling a background) and the same popover list (with a
// spinner while its options load lazily). Kept local to this file since
// nothing else needs it.
function BadgePicker({
  label,
  loading,
  options,
  open,
  onOpenChange,
  onSelect,
  disabled,
  clearLabel,
  onClear,
}: {
  readonly label: string;
  readonly loading: boolean;
  readonly options: { id: string; name: string }[];
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onSelect: (id: string) => void;
  readonly disabled: boolean;
  readonly clearLabel?: string;
  readonly onClear?: () => void;
}) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button type="button" disabled={disabled} className="w-full min-w-0">
          <Badge
            variant="outline"
            className="w-full justify-start text-sm px-2.5 py-1.5 cursor-pointer transition-colors hover:text-primary"
          >
            {/* Badge itself is inline-flex — text-overflow: ellipsis doesn't
                reliably apply directly on a flex container's own overflowing
                content, it needs a block-formatted child to truncate
                against. Without this nested span, a long name just got hard
                cut on both edges with no "…", instead of ellipsizing at the
                end. */}
            <span className="block truncate">{label}</span>
          </Badge>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="start">
        {loading ? (
          <div className="flex items-center justify-center py-3">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="custom-scrollbar flex flex-col gap-0.5 max-h-56 overflow-y-auto pr-1">
            {onClear && (
              <button
                type="button"
                className="rounded-md px-2 py-1.5 text-left smalltext text-muted-foreground transition-colors hover:text-primary"
                onClick={onClear}
              >
                {clearLabel}
              </button>
            )}
            {options.map((opt) => (
              <button
                key={opt.id}
                type="button"
                className="rounded-md px-2 py-1.5 text-left smalltext transition-colors hover:text-primary"
                onClick={() => onSelect(opt.id)}
              >
                <span className="block truncate">{opt.name}</span>
              </button>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

export function SuggestedFeatureCard({
  feature,
  slug,
  actorEmail,
}: {
  readonly feature: SuggestedFeature;
  readonly slug: string;
  readonly actorEmail: string;
}) {
  const queryClient = useQueryClient();
  const [priorityOpen, setPriorityOpen] = useState(false);
  const [projectOpen, setProjectOpen] = useState(false);
  const [milestoneOpen, setMilestoneOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);

  // Both lazy — only fetched once their picker actually opens, so a row of N
  // cards doesn't fire N project/milestone lookups just from rendering.
  const { data: projects = [], isLoading: loadingProjects } = useQuery({
    queryKey: ["projects", slug],
    queryFn: () => fetchProjects(slug),
    enabled: projectOpen,
  });

  const { data: milestones = [], isLoading: loadingMilestones } = useQuery({
    queryKey: ["milestones", feature.linear_project_id],
    queryFn: () => fetchMilestones(feature.linear_project_id),
    enabled: milestoneOpen,
  });

  const acceptMutation = useMutation({
    mutationFn: (priority: string) => acceptSuggestedFeature(feature.id, priority, actorEmail),
    onSuccess: (updated) => {
      toast.success(
        updated.linear_issue_identifier
          ? `Created ${updated.linear_issue_identifier} in Backlog`
          : "Feature accepted",
      );
      queryClient.invalidateQueries({ queryKey: ["suggested-features", slug] });
      // The new ticket lands in Backlog — refresh the Build page's own
      // Backlog panel so it shows up there without a manual reload.
      queryClient.invalidateQueries({ queryKey: ["linear-issues", slug] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const declineMutation = useMutation({
    mutationFn: () => declineSuggestedFeature(feature.id, actorEmail),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suggested-features", slug] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const milestoneMutation = useMutation({
    mutationFn: (milestoneId: string | null) =>
      updateSuggestionMilestone(feature.id, milestoneId, actorEmail),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suggested-features", slug] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const projectMutation = useMutation({
    mutationFn: (projectId: string) => updateSuggestionProject(feature.id, projectId, actorEmail),
    onSuccess: () => {
      // The backend clears the milestone when the project changes (it
      // belonged to the old one) — refreshing this suggestion is enough to
      // pick that up, same query the milestone mutation already invalidates.
      queryClient.invalidateQueries({ queryKey: ["suggested-features", slug] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const busy = acceptMutation.isPending || declineMutation.isPending;
  const pickersDisabled = milestoneMutation.isPending || projectMutation.isPending;

  return (
    // Same dark-card treatment as IssueCard's non-lightCard branch (Business
    // Reviews/Acceptance Testing/Backlog on this same page) — plain relative
    // div, not the shadcn <Card> (which is a genuinely light/cream surface,
    // see app/globals.css's "Light card" block — that's what made the
    // project/milestone badges unreadable before this).
    <div className="group relative w-80 shrink-0 flex flex-col rounded-lg border border-border bg-background">
      {/* No priority yet — a suggestion only gets one once accepted — so the
          stripe is just the app's fixed orange accent, matching priorityLabel
          "Medium"'s bg-primary and the "Suggested Feature" branding color,
          not a real priority signal. */}
      <span
        className="absolute inset-y-0 left-0 w-1 rounded-l-lg bg-primary"
        aria-hidden="true"
      />

      {/* Descriptions get clamped to 4 lines below and some run past that —
          this opens a modal with the untruncated text instead of leaving
          "…" as a dead end. Hidden until hover/focus, same reveal pattern as
          IssueCard's own edit button. */}
      <button
        type="button"
        className="absolute top-2 right-2 z-10 p-1.5 rounded-md opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity text-muted-foreground hover:bg-secondary hover:text-primary"
        onClick={() => setDetailOpen(true)}
        aria-label="View full description"
      >
        <Maximize2 className="h-3.5 w-3.5" />
      </button>

      <div className="p-4 pl-5 pb-2 space-y-1.5">
        <div className="flex items-center gap-1.5 text-primary">
          <Lightbulb className="h-3.5 w-3.5" />
          <span className="smalltext font-semibold uppercase tracking-wide">Suggested Feature</span>
        </div>
        <p className="text-base font-semibold leading-snug text-foreground">{feature.title}</p>
      </div>

      <div className="flex-1 space-y-3 px-4 pl-5 pb-3">
        <p className="smalltext text-muted-foreground line-clamp-4">{feature.description}</p>
        <div className="flex flex-col gap-2">
          {/* AI-picked (or previously overridden) project — re-validated
              against this customer's own customers.linear_projects on every
              change (updateSuggestionProject.ts), never trusted blind.
              Switching projects clears the milestone server-side, since it
              belonged to whichever project was selected before. */}
          <BadgePicker
            label={feature.linear_project_name}
            loading={loadingProjects}
            options={projects}
            open={projectOpen}
            onOpenChange={setProjectOpen}
            onSelect={(id) => {
              setProjectOpen(false);
              projectMutation.mutate(id);
            }}
            disabled={pickersDisabled}
          />

          {/* AI-picked (or previously overridden) milestone — always one of
              this suggestion's own project's real milestones, never trusted
              blind (see generateSuggestion.ts's matchedMilestone check and
              updateSuggestionMilestone.ts's own re-validation). Developers
              never see this card at all (gated in suggested-features-row.tsx),
              so no separate read-only path needed here. */}
          <BadgePicker
            label={feature.linear_milestone_name ?? "No milestone"}
            loading={loadingMilestones}
            options={milestones}
            open={milestoneOpen}
            onOpenChange={setMilestoneOpen}
            onSelect={(id) => {
              setMilestoneOpen(false);
              milestoneMutation.mutate(id);
            }}
            disabled={pickersDisabled}
            clearLabel="No milestone"
            onClear={() => {
              setMilestoneOpen(false);
              milestoneMutation.mutate(null);
            }}
          />
        </div>
      </div>

      <div className="flex items-center gap-2 p-4 pl-5 pt-0">
        <Button
          size="sm"
          variant="ghost"
          className="flex-1"
          disabled={busy}
          onClick={() => declineMutation.mutate()}
        >
          <X className="h-3.5 w-3.5 mr-1.5" />
          {declineMutation.isPending ? "Declining…" : "Decline"}
        </Button>

        <Popover open={priorityOpen} onOpenChange={setPriorityOpen}>
          <PopoverTrigger asChild>
            <Button size="sm" variant="default" className="flex-1" disabled={busy}>
              <Check className="h-3.5 w-3.5 mr-1.5" />
              {acceptMutation.isPending ? "Accepting…" : "Accept"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-2" align="end">
            <p className="smalltext text-muted-foreground px-1 pb-1.5">
              Set priority to accept
            </p>
            <div className="flex flex-col gap-1">
              {PRIORITY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className="rounded-md px-2 py-1.5 text-left smalltext transition-colors hover:text-primary"
                  onClick={() => {
                    setPriorityOpen(false);
                    acceptMutation.mutate(opt.value);
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent
          className="w-[95vw] sm:w-full sm:max-w-lg max-h-[85vh] overflow-y-auto overflow-x-hidden"
          aria-describedby={undefined}
        >
          <div className="-mx-6 -mt-6 h-1 bg-gradient-to-r from-primary via-primary/60 to-transparent" />

          <DialogHeader className="pt-4">
            <div className="flex items-center gap-1.5 text-primary">
              <Lightbulb className="h-3.5 w-3.5" />
              <span className="smalltext font-semibold uppercase tracking-wide">Suggested Feature</span>
            </div>
            <DialogTitle className="text-left">{feature.title}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{feature.description}</p>
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="outline" className="smalltext">
                {feature.linear_project_name}
              </Badge>
              {feature.linear_milestone_name && (
                <Badge variant="outline" className="smalltext">
                  {feature.linear_milestone_name}
                </Badge>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
