"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Lightbulb, X } from "lucide-react";
import { Button } from "@/components/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { priorityColors } from "@/components/client/issues.types";
import {
  acceptSuggestedFeature,
  declineSuggestedFeature,
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

export function SuggestedFeatureCard({
  feature,
  slug,
}: {
  readonly feature: SuggestedFeature;
  readonly slug: string;
}) {
  const queryClient = useQueryClient();
  const [priorityOpen, setPriorityOpen] = useState(false);

  const acceptMutation = useMutation({
    mutationFn: (priority: string) => acceptSuggestedFeature(feature.id, priority),
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
    mutationFn: () => declineSuggestedFeature(feature.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suggested-features", slug] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const busy = acceptMutation.isPending || declineMutation.isPending;

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

      <div className="p-4 pl-5 pb-2 space-y-1.5">
        <div className="flex items-center gap-1.5 text-primary">
          <Lightbulb className="h-3.5 w-3.5" />
          <span className="smalltext font-semibold uppercase tracking-wide">Suggested Feature</span>
        </div>
        <p className="text-base font-semibold leading-snug text-foreground">{feature.title}</p>
      </div>

      <div className="flex-1 space-y-3 px-4 pl-5 pb-3">
        <p className="smalltext text-muted-foreground line-clamp-4">{feature.description}</p>
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
                  className={`rounded-md border px-2 py-1.5 text-left smalltext transition-opacity hover:opacity-80 ${priorityColors[opt.label]}`}
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
    </div>
  );
}
