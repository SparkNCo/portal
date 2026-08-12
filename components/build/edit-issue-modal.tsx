"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/components/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUser } from "context/UserContext";
import { API_JSON_HEADERS } from "@/lib/api-headers";
import type { Issue } from "@/components/client/issues.types";

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
        className={`w-[95vw] sm:w-full max-h-[85vh] overflow-y-auto transition-all duration-200 ${
          isExpanded
            ? "sm:max-w-2xl md:max-w-4xl lg:max-w-5xl"
            : "sm:max-w-lg md:max-w-xl lg:max-w-2xl"
        }`}
        aria-describedby={undefined}
      >
        <DialogHeader>
          <div className="flex items-center justify-between gap-3 pr-6">
            <DialogTitle className="text-primary">Edit Ticket</DialogTitle>
            <button
              type="button"
              onClick={() => setIsExpanded((e) => !e)}
              className="hidden lg:inline-flex text-muted-foreground hover:text-foreground transition-colors"
              aria-label={isExpanded ? "Shrink modal" : "Expand modal"}
              title={isExpanded ? "Shrink" : "Expand"}
            >
              {isExpanded ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </button>
          </div>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="edit-issue-title" className="smalltext">Title</Label>
            <Input
              id="edit-issue-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="bg-secondary border-0 smalltext text-card-foreground placeholder:text-card-foreground/40"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label className="smalltext">Description</Label>
            <RichTextEditor
              value={description}
              onChange={setDescription}
              className="border-0"
              minHeight="140px"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="smalltext">Priority</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger className="h-8 text-xs md:smalltext">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRIORITY_OPTIONS.map((p) => (
                  <SelectItem key={p} value={p} className="focus:text-primary text-xs md:smalltext">
                    {p === "none"
                      ? "No priority"
                      : p.charAt(0).toUpperCase() + p.slice(1)}
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
