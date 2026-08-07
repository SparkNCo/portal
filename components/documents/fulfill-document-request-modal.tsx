"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Upload, File as FileIcon, X } from "lucide-react";
import { Button } from "@/components/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useUser } from "context/UserContext";
import { API_HEADERS, API_JSON_HEADERS } from "@/lib/api-headers";
import type { DocumentRequest } from "./use-document-requests";

async function uploadDocument({
  file,
  email,
  projectSlug,
}: {
  file: File;
  email: string;
  projectSlug?: string;
}) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("bucket", "documents_bucket");
  formData.append("path", `uploads/${Date.now()}-${file.name}`);
  formData.append("email", email);
  if (projectSlug) formData.append("project_slug", projectSlug);

  const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/storage`, {
    method: "POST",
    headers: API_HEADERS,
    body: formData,
  });
  if (!res.ok) throw new Error("Failed to upload document");
  return res.json();
}

async function shareDocument(payload: {
  document_id: number;
  emails: string[];
  user_id: string | undefined;
}) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/storage/share`, {
    method: "POST",
    headers: API_JSON_HEADERS,
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to share document");
  return res.json();
}

async function markRequestDone(payload: { id: string; completedBy?: string }) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/document-requests`, {
    method: "PATCH",
    headers: API_JSON_HEADERS,
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to update request");
  return res.json();
}

export function FulfillDocumentRequestModal({
  request,
  onClose,
  onFulfilled,
}: {
  readonly request: DocumentRequest;
  /** Called when the modal is dismissed without finishing (Cancel/X) — the caller should release the claim. */
  readonly onClose: () => void;
  /** Called after the document was uploaded, shared, and the request marked done. */
  readonly onFulfilled: () => void;
}) {
  const { profile } = useUser();
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // request.customer_slug is the clientName-based routing slug (e.g.
  // "acme-corp"), not the Linear initiative slug documents are actually
  // filed under (documents.project_slug) — every other upload path resolves
  // that real linear_slug before uploading (see app/[slug]/(portal)/documents/page.tsx),
  // this one didn't, so fulfilled documents never showed up in the
  // customer's Project Documents list. Resolve it from the authoritative
  // source (portal.customers.linear_slug, via the same customers list every
  // role already fetches through this endpoint — see usePinnedPanelsOwnerId)
  // rather than the developer's own assignment_id cache, which can drift out
  // of exact-text sync with customer_slug (see
  // project_linear_slug_case_insensitive memory).
  const { data: customers } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/users?type=customers`,
        { headers: API_JSON_HEADERS },
      );
      if (!res.ok) throw new Error("Failed to fetch customers");
      return res.json() as Promise<
        { clientName: string; linear_slug: string | null }[]
      >;
    },
  });

  const resolvedProjectSlug =
    customers?.find(
      (c) => c.clientName?.toLowerCase() === request.customer_slug?.toLowerCase(),
    )?.linear_slug ?? request.customer_slug;

  const mutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("No file selected");
      const { document } = await uploadDocument({
        file,
        email: profile?.email ?? "",
        projectSlug: resolvedProjectSlug,
      });
      await shareDocument({
        document_id: document.id,
        emails: [request.requested_by],
        user_id: profile?.id,
      });
      await markRequestDone({ id: request.id, completedBy: profile?.email });
    },
    onSuccess: () => {
      toast.success(`Document shared with ${request.requested_by}`);
      queryClient.invalidateQueries({ queryKey: ["document-requests"] });
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      onFulfilled();
    },
    onError: () => toast.error("Failed to upload and share document. Please try again."),
  });

  function handleFiles(files: File[]) {
    if (files[0]) setFile(files[0]);
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Upload & Share Document</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 pt-2">
          <p className="text-sm text-muted-foreground">
            Fulfilling <span className="font-medium text-foreground">{request.title}</span> —
            requested by {request.requested_by}
          </p>

          <div
            role="button"
            tabIndex={0}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              handleFiles(Array.from(e.dataTransfer.files));
            }}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            className={cn(
              "flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors cursor-pointer",
              isDragging
                ? "border-primary bg-primary/10"
                : "border-border hover:border-primary/50 hover:bg-secondary/30",
            )}
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mb-3">
              <Upload className="h-6 w-6 text-primary" />
            </div>
            <p className="text-sm font-medium text-center">
              Drag and drop a file here, or click to browse
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              PDF, DOCX, XLSX, PNG, JPG up to 50MB
            </p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={(e) => handleFiles(Array.from(e.target.files ?? []))}
            aria-label="Upload requested document file"
          />

          {file && (
            <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 p-2">
              <div className="flex items-center gap-2 min-w-0">
                <FileIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <p className="text-sm truncate">{file.name}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 flex-shrink-0"
                onClick={() => setFile(null)}
                aria-label={`Remove ${file.name}`}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={mutation.isPending}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={() => mutation.mutate()}
              disabled={!file || mutation.isPending}
              className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {mutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Upload & Share"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
