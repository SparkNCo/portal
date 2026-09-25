"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Upload, FileQuestion, FileCheck2, Lock, Loader2, UserMinus, Hand, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import { useUser } from "context/UserContext";
import { API_JSON_HEADERS } from "@/lib/api-headers";
import { useDocumentRequests, type DocumentRequest } from "./use-document-requests";
import { FulfillDocumentRequestModal } from "./fulfill-document-request-modal";
import { RequestDocumentDialog } from "./request-document-dialog";

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
  const isDone = request.status === "done";

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="w-[95vw] sm:w-full sm:max-w-lg max-h-[85vh] overflow-y-auto overflow-x-hidden"
        aria-describedby={undefined}
      >
        {/* Accent bar ties the modal back to the row it was opened from —
            green for a delivered document, orange (same as every other
            modal's accent) for one still pending. */}
        <div
          className={cn(
            "-mx-6 -mt-6 h-1 bg-gradient-to-r to-transparent",
            isDone ? "from-success via-success/60" : "from-primary via-primary/60",
          )}
        />

        <DialogHeader className="pt-4">
          <div className="flex min-w-0 items-center gap-3.5 pr-6">
            <div
              className={cn(
                "flex h-14 w-14 shrink-0 items-center justify-center rounded-full ring-2",
                isDone
                  ? "bg-success/10 text-success ring-success/30"
                  : "bg-warning/10 text-warning ring-warning/30",
              )}
            >
              {isDone ? <FileCheck2 className="h-6 w-6" /> : <FileQuestion className="h-6 w-6" />}
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <DialogTitle className="truncate text-primary">{request.title}</DialogTitle>
              {request.project_name && (
                <p className="smalltext text-muted-foreground truncate">
                  {request.project_name}
                </p>
              )}
              <Badge
                variant="outline"
                className={cn(
                  "smalltext",
                  isDone
                    ? "border-success/30 bg-success/10 text-success"
                    : "border-warning/30 bg-warning/10 text-warning",
                )}
              >
                {isDone ? "Done" : "Pending"}
              </Badge>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 pt-4 mt-1 border-t border-border">
          {relatedRequest && (
            <p className="smalltext text-muted-foreground">
              Related to: <span className="text-foreground">{relatedRequest.title}</span>
            </p>
          )}

          <div>
            <p className="smalltext font-medium text-foreground mb-1.5">Details</p>
            <div className="rounded-lg bg-muted/40 p-3">
              {request.description ? (
                <div
                  className="smalltext text-foreground prose prose-sm prose-invert max-w-none leading-relaxed
                  [&_p]:mb-2 [&_p:last-child]:mb-0
                  [&_ul]:list-disc [&_ul]:pl-4 [&_ul]:mb-2 [&_ul]:space-y-1
                  [&_ol]:list-decimal [&_ol]:pl-4 [&_ol]:mb-2 [&_ol]:space-y-1
                  [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-md [&_img]:my-2"
                >
                  <ReactMarkdown remarkPlugins={[remarkBreaks]}>{request.description}</ReactMarkdown>
                </div>
              ) : (
                <p className="smalltext text-muted-foreground">No additional details provided.</p>
              )}
            </div>
          </div>

          <p className="smalltext text-muted-foreground">
            Requested by {request.requested_by} ·{" "}
            {new Date(request.created_at).toLocaleDateString()}
            {request.customer_slug ? ` · ${request.customer_slug}` : ""}
          </p>

          {isDone && request.completed_by && (
            <p className="smalltext text-muted-foreground">
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
  const [showEdit, setShowEdit] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["document-requests"] });

  // Resolves the "Claimed by" badge to a human name instead of a bare email
  // — firstName+lastName, falling back to userName, falling back to the
  // email itself when none of those are set.
  const claimedByUserQuery = useQuery({
    queryKey: ["user-by-email", request.claimed_by],
    queryFn: async () => {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/users?email=${encodeURIComponent(request.claimed_by!)}`,
        { headers: API_JSON_HEADERS },
      );
      if (!res.ok) throw new Error("Failed to fetch claimer");
      return res.json() as Promise<{
        firstName?: string | null;
        lastName?: string | null;
        userName?: string | null;
        email?: string | null;
      } | null>;
    },
    enabled: !!request.claimed_by,
    staleTime: 5 * 60 * 1000,
  });
  const claimedByUser = claimedByUserQuery.data;
  const claimedByDisplayName = claimedByUser?.firstName
    ? `${claimedByUser.firstName} ${claimedByUser.lastName ?? ""}`.trim()
    : claimedByUser?.userName || claimedByUser?.email || request.claimed_by;

  const claimMutation = useMutation({
    mutationFn: () =>
      patchDocumentRequest({ action: "claim", id: request.id, claimedBy: profile?.email }),
    // Just claims — doesn't open the upload modal yet. The button relabels
    // itself to "Upload & Share" once claimed (see the JSX below), and *that*
    // click is what opens FulfillDocumentRequestModal. Splitting these into
    // two explicit steps makes "claim" a visible, deliberate action instead
    // of something that silently happens as a side effect of hitting Upload.
    onSuccess: invalidate,
    onError: (err: Error) => {
      toast.error(err.message);
      invalidate();
    },
  });

  // Frees up a claim — either automatically when the claimer backs out of
  // their own upload (see handleCancelFulfill below), or explicitly via the
  // admin-only "Unassign" button on a request claimed by someone else, for
  // when a developer claims a request and then goes quiet on it.
  const releaseMutation = useMutation({
    mutationFn: () =>
      patchDocumentRequest({ action: "release", id: request.id, releasedBy: profile?.email }),
    onSuccess: invalidate,
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: () =>
      patchDocumentRequest({ action: "delete", id: request.id, deletedBy: profile?.email }),
    onSuccess: () => {
      toast.success("Request deleted");
      invalidate();
      setShowDeleteConfirm(false);
    },
    onError: (err: Error) => {
      toast.error(err.message);
      setShowDeleteConfirm(false);
    },
  });

  const claimedByMe = request.claimed_by === profile?.email;
  const claimedBySomeoneElse = !!request.claimed_by && !claimedByMe;
  const isAdmin = profile?.role === "admin";
  // Only the requester can edit/delete their own request (no admin bypass)
  // — and only while it's unclaimed (a developer is already working off it
  // otherwise) and not yet done (the document was already delivered against
  // whatever it said at the time). Matches editDocumentRequest.ts/
  // deleteDocumentRequest.ts's own rules.
  const canEditOrDelete =
    request.requested_by === profile?.email && request.status !== "done" && !request.claimed_by;

  function handleFulfillClick() {
    if (claimedByMe) {
      setShowFulfill(true);
    } else {
      claimMutation.mutate();
    }
  }

  function handleCancelFulfill() {
    setShowFulfill(false);
    if (claimedByMe) releaseMutation.mutate();
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
            <p className="smalltext font-medium text-foreground">{request.title}</p>
            <Badge
              variant="outline"
              className={`smalltext ${
                request.status === "done"
                  ? "border-success/30 bg-success/10 text-success"
                  : "border-warning/30 bg-warning/10 text-warning"
              }`}
            >
              {request.status === "done" ? "Done" : "Pending"}
            </Badge>
            {request.status === "pending" && claimedBySomeoneElse && (
              <Badge variant="outline" className="smalltext border-muted-foreground/30 text-muted-foreground">
                <Lock className="h-3 w-3 mr-1" />
                Claimed by {claimedByDisplayName}
              </Badge>
            )}
          </div>
          <p className="smalltext text-muted-foreground">
            Requested by {request.requested_by} ·{" "}
            {new Date(request.created_at).toLocaleDateString()}
            {request.customer_slug ? ` · ${request.customer_slug}` : ""}
          </p>
        </button>

        {canEditOrDelete && (
          <>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowEdit(true)}
              className="flex-shrink-0 smalltext text-muted-foreground"
              aria-label={`Edit ${request.title}`}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowDeleteConfirm(true)}
              className="flex-shrink-0 smalltext text-muted-foreground hover:text-destructive"
              aria-label={`Delete ${request.title}`}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </>
        )}

        {canManage && request.status === "pending" && !claimedBySomeoneElse && (
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <Button
              size="sm"
              variant="outline"
              disabled={claimMutation.isPending}
              onClick={handleFulfillClick}
              className="flex-shrink-0 smalltext"
            >
              {claimMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : claimedByMe ? (
                <>
                  <Upload className="h-3.5 w-3.5 mr-1.5" />
                  Upload & Share
                </>
              ) : (
                <>
                  <Hand className="h-3.5 w-3.5 mr-1.5" />
                  Claim
                </>
              )}
            </Button>

            {/* Lets the claimer back out without opening the upload modal
                just to hit Cancel in it — same release action that modal's
                Cancel already triggers, just reachable directly from the row. */}
            {claimedByMe && (
              <Button
                size="sm"
                variant="ghost"
                disabled={releaseMutation.isPending}
                onClick={() => releaseMutation.mutate()}
                className="flex-shrink-0 smalltext text-muted-foreground"
                aria-label="Unassign yourself from this request"
              >
                {releaseMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <UserMinus className="h-3.5 w-3.5" />
                )}
              </Button>
            )}
          </div>
        )}

        {/* Admin-only escape hatch for a request stuck claimed by someone
            who never followed through — everyone else releases their own
            claim automatically by cancelling the upload modal instead. */}
        {isAdmin && request.status === "pending" && claimedBySomeoneElse && (
          <Button
            size="sm"
            variant="ghost"
            disabled={releaseMutation.isPending}
            onClick={() => releaseMutation.mutate()}
            className="flex-shrink-0 smalltext text-muted-foreground"
          >
            {releaseMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <>
                <UserMinus className="h-3.5 w-3.5 mr-1.5" />
                Unassign
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

      {showEdit && (
        <RequestDocumentDialog
          customerSlug={request.customer_slug}
          requestedBy={profile?.email}
          editingRequest={request}
          open={showEdit}
          onOpenChange={setShowEdit}
        />
      )}

      {showFulfill && (
        <FulfillDocumentRequestModal
          request={request}
          onClose={handleCancelFulfill}
          onFulfilled={() => setShowFulfill(false)}
        />
      )}

      <Dialog open={showDeleteConfirm} onOpenChange={(v) => !v && setShowDeleteConfirm(false)}>
        <DialogContent
          className="w-[95vw] sm:w-full sm:max-w-lg overflow-x-hidden"
          aria-describedby={undefined}
        >
          <div className="-mx-6 -mt-6 h-1 bg-gradient-to-r from-destructive via-destructive/60 to-transparent" />

          <DialogHeader className="pt-4">
            <div className="flex min-w-0 items-center gap-3.5 pr-6">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-red-400 ring-2 ring-destructive/30">
                <Trash2 className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <DialogTitle className="truncate text-red-400">Delete Request?</DialogTitle>
                <p className="smalltext text-muted-foreground">This can't be undone.</p>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-5 pt-4 mt-1 border-t border-border">
            <p className="smalltext text-foreground">
              Delete "{request.title}"?
            </p>

            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="smalltext"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleteMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="smalltext bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? "Deleting…" : "Delete"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
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
    <Card className="bg-background border-transparent sm:border-border rounded-none sm:rounded-xl text-foreground">
      <CardHeader>
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {requests.length === 0 && (
          <p className="smalltext text-muted-foreground italic">{emptyMessage}</p>
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
            className="w-full smalltext"
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
      <Card className="bg-background border-transparent sm:border-border rounded-none sm:rounded-xl text-foreground">
        <CardContent className="pt-6">
          <p className="smalltext text-muted-foreground animate-pulse">Loading…</p>
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
        title="Requests Fulfilled"
        icon={<FileCheck2 className="h-4 w-4 text-success" />}
        requests={doneRequests}
        canManage={canManage}
        emptyMessage="No documents delivered yet."
        requestsById={requestsById}
      />
    </div>
  );
}
