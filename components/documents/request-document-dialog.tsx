"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, FileText } from "lucide-react";
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
import { useDocumentRequests } from "./use-document-requests";

async function postDocumentRequest(payload: {
  customerSlug: string;
  requestedBy: string;
  title: string;
  description?: string;
  projectId?: string;
  projectName?: string;
  relatedRequestId?: string;
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
  const [selectedRelatedRequestId, setSelectedRelatedRequestId] = useState("");

  const { data: projects = [] } = useQuery({
    queryKey: ["projects", customerSlug],
    queryFn: () => fetchProjects(customerSlug),
    enabled: open && !!customerSlug,
  });

  const { data: pastRequests = [] } = useDocumentRequests(customerSlug);

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
    setSelectedRelatedRequestId("");
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
      relatedRequestId: selectedRelatedRequestId || undefined,
    });
  }

  return (
    <>
      <Button
        size="sm"
        onClick={() => setOpen(true)}
        className="bg-primary text-primary-foreground hover:bg-primary/90"
      >
        <Plus className="h-4 w-4 mr-2" />
        Request Report or Documentation
      </Button>

      <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
        <DialogContent
          className="w-[95vw] sm:w-full sm:max-w-lg max-h-[85vh] overflow-y-auto overflow-x-hidden"
          aria-describedby={undefined}
        >
          {/* Orange accent bar ties the modal back to the card it was opened from. */}
          <div className="-mx-6 -mt-6 h-1 bg-gradient-to-r from-primary via-primary/60 to-transparent" />

          <DialogHeader className="pt-4">
            <div className="flex min-w-0 items-center gap-3.5 pr-6">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary ring-2 ring-primary/30">
                <FileText className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <DialogTitle className="truncate text-primary">
                  Request a Report or Document
                </DialogTitle>
                <p className="smalltext text-muted-foreground">
                  Ask the team to prepare a report or document for you.
                </p>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 pt-4 mt-1 border-t border-border">
            <div className="space-y-1.5">
              <Label htmlFor="doc-request-title" className="smalltext">What Do You Need?</Label>
              <Input
                id="doc-request-title"
                placeholder="e.g. Q3 performance report"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="smalltext bg-secondary border-0"
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="doc-request-project" className="smalltext">
                Project{" "}
                <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                <SelectTrigger id="doc-request-project" className="smalltext bg-secondary border-0">
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

            {pastRequests.length > 0 && (
              <div className="space-y-1.5">
                <Label htmlFor="doc-request-related" className="smalltext">
                  Related to a Previous Request{" "}
                  <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Select
                  value={selectedRelatedRequestId}
                  onValueChange={setSelectedRelatedRequestId}
                >
                  <SelectTrigger id="doc-request-related" className="smalltext bg-secondary border-0">
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    {pastRequests.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="doc-request-details" className="smalltext">
                Details{" "}
                <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Textarea
                id="doc-request-details"
                placeholder="Any context that helps the team prepare this..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="smalltext bg-secondary border-0 min-h-[90px] resize-none"
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
