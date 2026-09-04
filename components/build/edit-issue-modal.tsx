"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ExpandableDialogChrome } from "@/components/shared/expandable-dialog-chrome";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUser } from "context/UserContext";
import { API_JSON_HEADERS } from "@/lib/api-headers";
import { getIssueCode } from "@/lib/utils";
import { type Issue, priorityColors, statusColors } from "@/components/client/issues.types";

async function patchIssue(payload: {
  issueId: string;
  title: string;
  description: string;
  priority: string;
  actorEmail?: string;
  slug?: string;
}) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/issues/edit`, {
    method: "PATCH",
    headers: API_JSON_HEADERS,
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to update issue");
  return res.json();
}

const PRIORITY_OPTIONS = ["urgent", "high", "medium", "low", "none"] as const;

const PRIORITY_LABELS: Record<(typeof PRIORITY_OPTIONS)[number], Issue["priorityLabel"]> = {
  urgent: "Urgent",
  high: "High",
  medium: "Medium",
  low: "Low",
  none: "No priority",
};

export function EditIssueModal({
  issue,
  slug,
  onClose,
  onSaved,
}: {
  issue: Issue;
  slug: string;
  onClose: () => void;
  /** Called after a successful save, in addition to the built-in cache invalidation — use this to
   * invalidate any additional query keys the caller's issue list depends on (e.g. an aggregated
   * multi-project list that doesn't use the ["linear-issues", slug] key). */
  onSaved?: () => void;
}) {
  const queryClient = useQueryClient();
  const { profile } = useUser();
  const [isExpanded, setIsExpanded] = useState(false);
  const [title, setTitle] = useState(issue.title);
  const [description, setDescription] = useState(issue.description ?? "");
  const [priority, setPriority] = useState(
    issue.priorityLabel?.toLowerCase() || "none",
  );

  const mutation = useMutation({
    mutationFn: patchIssue,
    onSuccess: () => {
      toast.success("Ticket updated");
      queryClient.invalidateQueries({ queryKey: ["linear-issues", slug] });
      queryClient.invalidateQueries({ queryKey: ["issue-updates"] });
      onSaved?.();
      onClose();
    },
    onError: () => toast.error("Failed to update ticket. Please try again."),
  });

  function handleSave() {
    if (!title.trim()) return;
    mutation.mutate({
      issueId: issue.id,
      title: title.trim(),
      description,
      priority,
      slug,
      ...(profile?.email ? { actorEmail: profile.email } : {}),
    });
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className={`max-h-[90vh] overflow-y-auto overflow-x-hidden transition-all duration-200 ${
          isExpanded
            ? "sm:max-w-3xl md:max-w-5xl lg:max-w-6xl"
            : "sm:max-w-xl md:max-w-2xl lg:max-w-3xl"
        }`}
        aria-describedby={undefined}
      >
        <ExpandableDialogChrome
          isExpanded={isExpanded}
          onToggleExpanded={() => setIsExpanded((e) => !e)}
        />

        {/* Mirrors the ticket detail modal's header (code + priority +
            status, then the title) so this quick-edit form still reads as
            the same ticket rather than a generic form. Priority reflects
            the pending edit below (live preview); status is read-only here
            — this form doesn't change it. */}
        <DialogHeader className="pt-4 pr-12">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="smalltext font-mono text-muted-foreground">
              {getIssueCode(issue.branchName)}
            </span>
            <Badge
              variant="outline"
              className={`smalltext ${priorityColors[PRIORITY_LABELS[priority as (typeof PRIORITY_OPTIONS)[number]] ?? "No priority"]}`}
            >
              {PRIORITY_LABELS[priority as (typeof PRIORITY_OPTIONS)[number]] ?? "No priority"}
            </Badge>
            {issue.state?.name && (
              <Badge
                variant="secondary"
                className={`smalltext ${statusColors[issue.state.name as keyof typeof statusColors]}`}
              >
                {issue.state.name}
              </Badge>
            )}
          </div>
          <DialogTitle className="text-primary">Edit Ticket</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-4 mt-1 border-t border-border">
          <div className="space-y-1.5">
            <Label htmlFor="edit-issue-title" className="smalltext">Title</Label>
            <Input
              id="edit-issue-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="bg-muted/40 border-0 smalltext text-foreground placeholder:text-muted-foreground"
              placeholder="Brief summary..."
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label className="smalltext">Description</Label>
            <RichTextEditor
              value={description}
              onChange={setDescription}
              className="border-0 bg-muted/40 [&_.ProseMirror]:text-foreground"
              minHeight="140px"
              ariaLabel="Description"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-issue-priority" className="smalltext">Priority</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger id="edit-issue-priority" className="smalltext">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRIORITY_OPTIONS.map((p) => (
                  <SelectItem key={p} value={p} className="smalltext">
                    {PRIORITY_LABELS[p]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2 pt-1">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={mutation.isPending}
              className="flex-1 smalltext"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!title.trim() || mutation.isPending}
              className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 smalltext"
            >
              {mutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Save changes"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
