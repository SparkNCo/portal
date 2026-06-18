"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, FileQuestion, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useUser } from "context/UserContext";
import { API_JSON_HEADERS } from "@/lib/api-headers";
import { useDocumentRequests, type DocumentRequest } from "./use-document-requests";

async function patchDocumentRequestDone(payload: { id: string; completedBy?: string }) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_ENDPOINT}/document-requests`, {
    method: "PATCH",
    headers: API_JSON_HEADERS,
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to update request");
  return res.json();
}

function RequestDetailModal({
  request,
  onClose,
}: {
  readonly request: DocumentRequest;
  readonly onClose: () => void;
}) {
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{request.title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 pt-2">
          <Badge
            variant="outline"
            className={
              request.status === "done"
                ? "border-success/30 bg-success/10 text-success"
                : "border-warning/30 bg-warning/10 text-warning"
            }
          >
            {request.status === "done" ? "Done" : "Pending"}
          </Badge>

          {request.project_name && (
            <p className="text-sm font-medium text-foreground">
              {request.project_name}
            </p>
          )}

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
              Details
            </p>
            <p className="text-sm text-foreground whitespace-pre-wrap">
              {request.description || "No additional details provided."}
            </p>
          </div>

          <p className="text-[11px] text-muted-foreground">
            Requested by {request.requested_by} ·{" "}
            {new Date(request.created_at).toLocaleDateString()}
            {request.customer_slug ? ` · ${request.customer_slug}` : ""}
          </p>

          {request.status === "done" && request.completed_by && (
            <p className="text-[11px] text-muted-foreground">
              Completed by {request.completed_by}
              {request.completed_at
                ? ` · ${new Date(request.completed_at).toLocaleDateString()}`
                : ""}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RequestRow({
  request,
  canManage,
}: {
  readonly request: DocumentRequest;
  readonly canManage: boolean;
}) {
  const queryClient = useQueryClient();
  const { profile } = useUser();
  const [showDetail, setShowDetail] = useState(false);

  const mutation = useMutation({
    mutationFn: patchDocumentRequestDone,
    onSuccess: () => {
      toast.success("Marked as done");
      queryClient.invalidateQueries({ queryKey: ["document-requests"] });
    },
    onError: () => toast.error("Failed to update request. Please try again."),
  });

  return (
    <>
      <div className="flex items-start justify-between gap-3 rounded-lg bg-muted/40 p-3">
        <button
          type="button"
          onClick={() => setShowDetail(true)}
          className="flex-1 min-w-0 space-y-1 text-left hover:opacity-80 transition-opacity"
        >
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium text-foreground">{request.title}</p>
            <Badge
              variant="outline"
              className={
                request.status === "done"
                  ? "border-success/30 bg-success/10 text-success"
                  : "border-warning/30 bg-warning/10 text-warning"
              }
            >
              {request.status === "done" ? "Done" : "Pending"}
            </Badge>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Requested by {request.requested_by} ·{" "}
            {new Date(request.created_at).toLocaleDateString()}
            {request.customer_slug ? ` · ${request.customer_slug}` : ""}
          </p>
        </button>

        {canManage && request.status === "pending" && (
          <Button
            size="sm"
            variant="outline"
            disabled={mutation.isPending}
            onClick={() =>
              mutation.mutate({ id: request.id, completedBy: profile?.email })
            }
            className="flex-shrink-0"
          >
            {mutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <>
                <Check className="h-3.5 w-3.5 mr-1.5" />
                Mark as Done
              </>
            )}
          </Button>
        )}
      </div>

      {showDetail && (
        <RequestDetailModal request={request} onClose={() => setShowDetail(false)} />
      )}
    </>
  );
}

export function DocumentRequestsList({
  customerSlug,
  canManage = false,
}: {
  readonly customerSlug?: string;
  readonly canManage?: boolean;
}) {
  const { data: requests = [], isLoading } = useDocumentRequests(customerSlug);

  return (
    <Card className="bg-background border-border">
      <CardHeader>
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <FileQuestion className="h-4 w-4 text-warning" />
          Document Requests
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading && (
          <p className="text-xs text-muted-foreground animate-pulse">Loading…</p>
        )}
        {!isLoading && requests.length === 0 && (
          <p className="text-sm text-muted-foreground italic">No requests yet.</p>
        )}
        {requests.map((request) => (
          <RequestRow key={request.id} request={request} canManage={canManage} />
        ))}
      </CardContent>
    </Card>
  );
}
