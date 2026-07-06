"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus } from "lucide-react";
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
import { API_JSON_HEADERS } from "@/lib/api-headers";
import { fetchProjects } from "@/lib/issues-api";
import { DialogFooterActions } from "@/components/shared/dialog-footer-actions";

async function postDocumentRequest(payload: {
  customerSlug: string;
  requestedBy: string;
  title: string;
  description?: string;
  projectId?: string;
  projectName?: string;
}) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/document-requests`, {
    method: "POST",
    headers: API_JSON_HEADERS,
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to submit request");
  return res.json();
}

export function RequestDocumentDialog({
  customerSlug,
  requestedBy,
}: {
  customerSlug: string;
  requestedBy?: string;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("");

  const { data: projects = [] } = useQuery({
    queryKey: ["projects", customerSlug],
    queryFn: () => fetchProjects(customerSlug),
    enabled: open && !!customerSlug,
  });

  const mutation = useMutation({
    mutationFn: postDocumentRequest,
    onSuccess: () => {
      toast.success("Request submitted");
      queryClient.invalidateQueries({ queryKey: ["document-requests"] });
      handleClose();
    },
    onError: () => toast.error("Failed to submit request. Please try again."),
  });

  function handleClose() {
    setOpen(false);
    setTitle("");
    setDescription("");
    setSelectedProjectId("");
  }

  function handleSubmit() {
    if (!title.trim() || !requestedBy) return;
    const selectedProject = projects.find((p) => p.id === selectedProjectId);
    mutation.mutate({
      customerSlug,
      requestedBy,
      title: title.trim(),
      description: description.trim() || undefined,
      projectId: selectedProject?.id,
      projectName: selectedProject?.name,
    });
  }

  return (
    <>
      <Button
        size="sm"
        onClick={() => setOpen(true)}
        className="bg-accent text-accent-foreground hover:bg-accent/90"
      >
        <Plus className="h-4 w-4 mr-2" />
        Request Report or Documentation
      </Button>

      <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
        <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Request a Report or Document</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>What do you need?</Label>
              <Input
                placeholder="e.g. Q3 performance report"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="bg-secondary border-0"
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label>
                Project{" "}
                <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                <SelectTrigger className="bg-secondary border-0">
                  <SelectValue
                    placeholder={
                      projects.length ? "Select a project…" : "Loading projects…"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>
                Details{" "}
                <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Textarea
                placeholder="Any context that helps the team prepare this..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="bg-secondary border-0 min-h-[90px] resize-none"
              />
            </div>

            <DialogFooterActions
              onCancel={handleClose}
              onSubmit={handleSubmit}
              submitDisabled={!title.trim()}
              pending={mutation.isPending}
              submitLabel="Submit Request"
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
