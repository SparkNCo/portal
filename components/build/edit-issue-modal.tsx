"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
}) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_ENDPOINT}/issues/edit`, {
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
}: {
  issue: Issue;
  slug: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { profile } = useUser();
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
      ...(profile?.email ? { actorEmail: profile.email } : {}),
    });
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="w-[95vw] sm:w-full sm:max-w-lg md:max-w-xl lg:max-w-2xl max-h-[85vh] overflow-y-auto"
        aria-describedby={undefined}
      >
        <DialogHeader>
          <DialogTitle>Edit Ticket</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="bg-secondary border-0"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="bg-secondary border-0 min-h-[140px] resize-none"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Priority</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger className="bg-secondary border-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRIORITY_OPTIONS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p === "none" ? "No priority" : p.charAt(0).toUpperCase() + p.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2 pt-1">
            <Button variant="outline" onClick={onClose} disabled={mutation.isPending} className="flex-1">
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!title.trim() || mutation.isPending}
              className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90"
            >
              {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save changes"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
