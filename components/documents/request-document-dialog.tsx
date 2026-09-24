"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, FileText } from "lucide-react";
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
import { API_JSON_HEADERS } from "@/lib/api-headers";
import { fetchProjects } from "@/lib/issues-api";
import { DialogFooterActions } from "@/components/shared/dialog-footer-actions";
import { ExpandableDialogChrome } from "@/components/shared/expandable-dialog-chrome";
import { useDocumentRequests, type DocumentRequest } from "./use-document-requests";

type RequestPayload = {
  customerSlug: string;
  requestedBy: string;
  title: string;
  description?: string;
  projectId?: string;
  projectName?: string;
  relatedRequestId?: string;
};

async function postDocumentRequest(payload: RequestPayload) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/document-requests`, {
    method: "POST",
    headers: API_JSON_HEADERS,
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to submit request");
  return res.json();
}

async function patchEditDocumentRequest(
  payload: { id: string; editedBy: string } & Omit<RequestPayload, "customerSlug" | "requestedBy">,
) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/document-requests`, {
    method: "PATCH",
    headers: API_JSON_HEADERS,
    body: JSON.stringify({ action: "edit", ...payload }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "Failed to update request");
  }
  return res.json();
}

export function RequestDocumentDialog({
  customerSlug,
  requestedBy,
  editingRequest,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: {
  customerSlug: string;
  requestedBy?: string;
  // Editing an existing request (PATCH) instead of creating a new one
  // (POST) — the requester or an admin. When set, this dialog is externally
  // controlled (open/onOpenChange) instead of rendering its own trigger
  // button; the caller (a request row) owns when it's open.
  editingRequest?: DocumentRequest;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const isEditing = !!editingRequest;
  const queryClient = useQueryClient();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = isEditing ? (controlledOpen ?? false) : internalOpen;
  const [title, setTitle] = useState(editingRequest?.title ?? "");
  const [description, setDescription] = useState(editingRequest?.description ?? "");
  const [selectedProjectId, setSelectedProjectId] = useState(editingRequest?.project_id ?? "");
  const [selectedRelatedRequestId, setSelectedRelatedRequestId] = useState(
    editingRequest?.related_request_id ?? "",
  );
  const [isExpanded, setIsExpanded] = useState(false);

  const { data: projects = [] } = useQuery({
    queryKey: ["projects", customerSlug],
    queryFn: () => fetchProjects(customerSlug),
    enabled: open && !!customerSlug,
  });

  const { data: allPastRequests = [] } = useDocumentRequests(customerSlug);
  // A request can't be related to itself.
  const pastRequests = isEditing
    ? allPastRequests.filter((r) => r.id !== editingRequest.id)
    : allPastRequests;

  const createMutation = useMutation({
    mutationFn: postDocumentRequest,
    onSuccess: () => {
      toast.success("Request submitted");
      queryClient.invalidateQueries({ queryKey: ["document-requests"] });
      handleClose();
    },
    onError: () => toast.error("Failed to submit request. Please try again."),
  });

  const editMutation = useMutation({
    mutationFn: patchEditDocumentRequest,
    onSuccess: () => {
      toast.success("Request updated");
      queryClient.invalidateQueries({ queryKey: ["document-requests"] });
      handleClose();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const mutation = isEditing ? editMutation : createMutation;

  function handleClose() {
    if (isEditing) {
      controlledOnOpenChange?.(false);
      return;
    }
    setInternalOpen(false);
    setTitle("");
    setDescription("");
    setSelectedProjectId("");
    setSelectedRelatedRequestId("");
    setIsExpanded(false);
  }

  function handleSubmit() {
    if (!title.trim() || !requestedBy) return;
    const selectedProject = projects.find((p) => p.id === selectedProjectId);

    if (isEditing) {
      editMutation.mutate({
        id: editingRequest.id,
        editedBy: requestedBy,
        title: title.trim(),
        description: description.trim() || undefined,
        projectId: selectedProject?.id,
        projectName: selectedProject?.name,
        relatedRequestId: selectedRelatedRequestId || undefined,
      });
      return;
    }

    createMutation.mutate({
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
      {!isEditing && (
        <Button
          size="sm"
          onClick={() => setInternalOpen(true)}
          className="bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4 mr-2" />
          Request Report or Documentation
        </Button>
      )}

      <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
        <DialogContent
          className={`w-[95vw] sm:w-full max-h-[85vh] overflow-y-auto overflow-x-hidden transition-all duration-200 ${
            isExpanded ? "sm:max-w-3xl md:max-w-4xl" : "sm:max-w-lg"
          }`}
          aria-describedby={undefined}
        >
          <ExpandableDialogChrome
            isExpanded={isExpanded}
            onToggleExpanded={() => setIsExpanded((e) => !e)}
          />

          <DialogHeader className="pt-4">
            <div className="flex min-w-0 items-center gap-3.5 pr-6">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary ring-2 ring-primary/30">
                <FileText className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <DialogTitle className="truncate text-primary">
                  {isEditing ? "Edit Request" : "Request a Report or Document"}
                </DialogTitle>
                <p className="smalltext text-muted-foreground">
                  {isEditing
                    ? "Update what you're asking for."
                    : "Ask the team to prepare a report or document for you."}
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
              <RichTextEditor
                id="doc-request-details"
                ariaLabel="Details"
                placeholder="Any context that helps the team prepare this..."
                value={description}
                onChange={setDescription}
                className="border-0"
                minHeight={isExpanded ? "260px" : "90px"}
              />
            </div>

            <DialogFooterActions
              onCancel={handleClose}
              onSubmit={handleSubmit}
              submitDisabled={!title.trim()}
              pending={mutation.isPending}
              submitLabel={isEditing ? "Save Changes" : "Submit Request"}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
