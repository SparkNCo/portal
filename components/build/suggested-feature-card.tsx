"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Lightbulb, Maximize2, X } from "lucide-react";
import { Button } from "@/components/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { priorityColors } from "@/components/client/issues.types";
import { fetchMilestones, fetchProjects } from "@/lib/issues-api";
import { InlineSelect } from "@/components/shared/inline-select";
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

// Project/milestone pickers: full-width badges, no dropdown chevron, hover
// just tints the text orange instead of filling a background.
const PICKER_STYLE = {
  triggerClassName: "w-full",
  badgeClassName:
    "w-full justify-start text-sm px-2.5 py-1.5 hover:opacity-100 hover:text-primary",
  optionClassName: "font-normal text-foreground hover:text-primary",
} as const;

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
    // Returned so isPending (and the badge spinner) lasts until the card has
    // refetched the new value, instead of flashing the old label first.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["suggested-features", slug] }),
    onError: (err: Error) => toast.error(err.message),
  });

  const projectMutation = useMutation({
    mutationFn: (projectId: string) => updateSuggestionProject(feature.id, projectId, actorEmail),
    // The backend clears the milestone when the project changes (it belonged
    // to the old one) — refreshing this suggestion is enough to pick that up.
    // Returned so the spinner lasts until the refetch lands.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["suggested-features", slug] }),
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

      {/* No "Suggested Feature" label per card — the row has the heading
          (SuggestedFeaturesRow). pr-8 keeps the title clear of the expand
          button in the corner. */}
      <div className="p-4 pl-5 pr-8 pb-2">
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
          <InlineSelect
            {...PICKER_STYLE}
            label={feature.linear_project_name}
            loading={loadingProjects}
            options={projects.map((p) => ({ value: p.id, label: p.name }))}
            value={feature.linear_project_id}
            onOpenChange={setProjectOpen}
            onSelect={(id) => projectMutation.mutate(id)}
            disabled={pickersDisabled}
            saving={projectMutation.isPending}
          />

          {/* AI-picked (or previously overridden) milestone — always one of
              this suggestion's own project's real milestones, never trusted
              blind (see generateSuggestion.ts's matchedMilestone check and
              updateSuggestionMilestone.ts's own re-validation). Developers
              never see this card at all (gated in suggested-features-row.tsx),
              so no separate read-only path needed here. */}
          <InlineSelect
            {...PICKER_STYLE}
            label={feature.linear_milestone_name ?? "No milestone"}
            loading={loadingMilestones}
            options={milestones.map((m) => ({ value: m.id, label: m.name }))}
            value={feature.linear_milestone_id}
            onOpenChange={setMilestoneOpen}
            onSelect={(id) => milestoneMutation.mutate(id)}
            disabled={pickersDisabled}
            // A project change also clears the milestone server-side.
            saving={milestoneMutation.isPending || projectMutation.isPending}
            clearLabel="No milestone"
            onClear={() => milestoneMutation.mutate(null)}
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
