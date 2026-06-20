"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Plus, Info } from "lucide-react";
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
import { API_JSON_HEADERS } from "@/lib/api-headers";

async function postProjectRequest(payload: {
  title: string;
  description?: string;
  requestedBy?: string;
  slug?: string;
}) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_ENDPOINT}/project-requests`, {
    method: "POST",
    headers: API_JSON_HEADERS,
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to submit project request");
  return res.json();
}

export function RequestProjectDialog({
  slug,
  requestedBy,
  compact,
}: {
  slug: string;
  requestedBy?: string;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const mutation = useMutation({
    mutationFn: postProjectRequest,
    onSuccess: () => {
      toast.success("Project request sent");
      handleClose();
    },
    onError: () => toast.error("Failed to send project request. Please try again."),
  });

  function handleClose() {
    setOpen(false);
    setTitle("");
    setDescription("");
  }

  function handleSubmit() {
    if (!title.trim()) return;
    mutation.mutate({
      title: title.trim(),
      description: description.trim() || undefined,
      requestedBy,
      slug,
    });
  }

  return (
    <>
      <Button
        size={compact ? "sm" : "default"}
        onClick={() => setOpen(true)}
        className="bg-accent text-accent-foreground hover:bg-accent/90"
      >
        <Plus className="h-4 w-4 mr-2" />
        New project Request
      </Button>

      <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
        <DialogContent
          className="w-[95vw] sm:w-full sm:max-w-2xl md:max-w-3xl lg:max-w-4xl max-h-[85vh] overflow-y-auto"
          aria-describedby={undefined}
        >
          <DialogHeader>
            <DialogTitle>New project Request</DialogTitle>
          </DialogHeader>

          <div className="flex items-start gap-2.5 rounded-md border border-blue-500/30 bg-blue-500/10 px-3 py-2.5">
            <Info className="h-4 w-4 mt-0.5 shrink-0 text-blue-500" />
            <p className="text-sm text-blue-600 dark:text-blue-300">
              Tell us about your idea and we&apos;ll email our team the details — no need to set anything up yourself.
            </p>
          </div>

          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input
                placeholder="Brief summary..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="bg-secondary border-0"
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label>
                Description{" "}
                <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <RichTextEditor
                placeholder="What is this project about?"
                value={description}
                onChange={setDescription}
                className="border-0"
                minHeight="220px"
              />
            </div>

            <div className="flex gap-2 pt-1">
              <Button
                variant="outline"
                onClick={handleClose}
                disabled={mutation.isPending}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!title.trim() || mutation.isPending}
                className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90"
              >
                {mutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Send Request"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
