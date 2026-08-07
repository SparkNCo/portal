"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Upload, FileQuestion, FileCheck2, Lock, Loader2 } from "lucide-react";
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
import { FulfillDocumentRequestModal } from "./fulfill-document-request-modal";

async function patchDocumentRequest(payload: Record<string, unknown>) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/document-requests`, {
    method: "PATCH",
    headers: API_JSON_HEADERS,
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "Failed to update request");
  }
  return res.json();
}

function RequestDetailModal({
  request,
  relatedRequest,
  onClose,
}: {
  readonly request: DocumentRequest;
  readonly relatedRequest?: DocumentRequest;
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

          {relatedRequest && (
            <p className="text-[11px] text-muted-foreground">
              Related to: <span className="text-foreground">{relatedRequest.title}</span>
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
  requestsById,
}: {
  readonly request: DocumentRequest;
  readonly canManage: boolean;
  readonly requestsById: Map<string, DocumentRequest>;
}) {
  const { profile } = useUser();
  const queryClient = useQueryClient();
  const [showDetail, setShowDetail] = useState(false);
  const [showFulfill, setShowFulfill] = useState(false);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["document-requests"] });

  const claimMutation = useMutation({
    mutationFn: () =>
      patchDocumentRequest({ action: "claim", id: request.id, claimedBy: profile?.email }),
    onSuccess: () => {
      invalidate();
      setShowFulfill(true);
    },
    onError: (err: Error) => {
      toast.error(err.message);
      invalidate();
    },
  });

  const claimedByMe = request.claimed_by === profile?.email;
  const claimedBySomeoneElse = !!request.claimed_by && !claimedByMe;

  function handleFulfillClick() {
    if (claimedByMe) {
      setShowFulfill(true);
    } else {
      claimMutation.mutate();
    }
  }

  function handleCancelFulfill() {
    setShowFulfill(false);
  }

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
            {request.status === "pending" && claimedBySomeoneElse && (
              <Badge variant="outline" className="border-muted-foreground/30 text-muted-foreground">
                <Lock className="h-3 w-3 mr-1" />
                Claimed by {request.claimed_by}
              </Badge>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Requested by {request.requested_by} ·{" "}
            {new Date(request.created_at).toLocaleDateString()}
            {request.customer_slug ? ` · ${request.customer_slug}` : ""}
          </p>
        </button>

        {canManage && request.status === "pending" && !claimedBySomeoneElse && (
          <Button
            size="sm"
            variant="outline"
            disabled={claimMutation.isPending}
            onClick={handleFulfillClick}
            className="flex-shrink-0"
          >
            {claimMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <>
                <Upload className="h-3.5 w-3.5 mr-1.5" />
                Upload & Share
              </>
            )}
          </Button>
        )}
      </div>

      {showDetail && (
        <RequestDetailModal
          request={request}
          relatedRequest={
            request.related_request_id ? requestsById.get(request.related_request_id) : undefined
          }
          onClose={() => setShowDetail(false)}
        />
      )}

      {showFulfill && (
        <FulfillDocumentRequestModal
          request={request}
          onClose={handleCancelFulfill}
          onFulfilled={() => setShowFulfill(false)}
        />
      )}
    </>
  );
}

const PAGE_SIZE = 3;

function RequestPanel({
  title,
  icon,
  requests,
  canManage,
  emptyMessage,
  requestsById,
}: {
  readonly title: string;
  readonly icon: React.ReactNode;
  readonly requests: DocumentRequest[];
  readonly canManage: boolean;
  readonly emptyMessage: string;
  readonly requestsById: Map<string, DocumentRequest>;
}) {
  const [limit, setLimit] = useState(PAGE_SIZE);
  const visible = requests.slice(0, limit);

  return (
    <Card className="bg-background border-border text-foreground">
      <CardHeader>
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {requests.length === 0 && (
          <p className="text-sm text-muted-foreground italic">{emptyMessage}</p>
        )}
        {visible.map((request) => (
          <RequestRow
            key={request.id}
            request={request}
            canManage={canManage}
            requestsById={requestsById}
          />
        ))}
        {requests.length > limit && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full"
            onClick={() => setLimit((l) => l + PAGE_SIZE)}
          >
            Show More
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export function DocumentRequestsList({
  customerSlug,
  canManage = false,
  assignedSlugs,
}: {
  readonly customerSlug?: string;
  readonly canManage?: boolean;
  /** When provided, only requests for these customer slugs are shown (e.g. a developer's assigned projects). */
  readonly assignedSlugs?: string[];
}) {
  const { data: allRequests = [], isLoading } = useDocumentRequests(customerSlug);

  // customer_slug is stored lowercased (from the URL slug) but
  // assignedSlugs comes from profile.assignment_id[].clientName, which can
  // have different casing (see project_linear_slug_case_insensitive memory)
  // — compare case-insensitively rather than relying on both sides matching.
  const assignedSlugsLower = assignedSlugs?.map((s) => s.toLowerCase());
  const requests = assignedSlugsLower
    ? allRequests.filter((r) =>
        assignedSlugsLower.includes(r.customer_slug?.toLowerCase()),
      )
    : allRequests;

  const pendingRequests = requests.filter((r) => r.status === "pending");
  const doneRequests = requests.filter((r) => r.status === "done");
  const requestsById = new Map(allRequests.map((r) => [r.id, r]));

  if (isLoading) {
    return (
      <Card className="bg-background border-border text-foreground">
        <CardContent className="pt-6">
          <p className="text-xs text-muted-foreground animate-pulse">Loading…</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <RequestPanel
        title="Document Requests"
        icon={<FileQuestion className="h-4 w-4 text-warning" />}
        requests={pendingRequests}
        canManage={canManage}
        emptyMessage={
          assignedSlugs ? "No requests for your assigned projects." : "No requests yet."
        }
        requestsById={requestsById}
      />
      <RequestPanel
        title="Documents Received"
        icon={<FileCheck2 className="h-4 w-4 text-success" />}
        requests={doneRequests}
        canManage={canManage}
        emptyMessage="No documents delivered yet."
        requestsById={requestsById}
      />
    </div>
  );
}
