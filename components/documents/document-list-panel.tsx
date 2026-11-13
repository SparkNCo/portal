"use client";

import { useState } from "react";
import {
  FileText,
  Download,
  ExternalLink,
  FileSpreadsheet,
  FileImage,
  File,
  Calendar,
  Settings,
  Trash2,
  Loader2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/components/ui/button";
import { InlineSelect } from "@/components/shared/inline-select";
import { cn } from "@/lib/utils";
import { useDeleteDocument, useUpdateDocument } from "./update-document-entry";
import { useUser } from "context/UserContext";
import { Share2 } from "lucide-react";
import { ShareDocumentModal } from "./ShareDocumentModal";
import { API_HEADERS } from "@/lib/api-headers";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DocumentPreviewModal, PREVIEWABLE_FORMATS, type PreviewableDoc } from "./document-preview-modal";

const formatIcons: Record<string, any> = {
  pdf: FileText,
  png: FileImage,
  jpg: FileImage,
  docx: FileText,
  xlsx: FileSpreadsheet,
  zip: File,
  md: FileText,
  markdown: FileText,
  txt: FileText,
  text: FileText,
  csv: FileSpreadsheet,
  mmd: FileText,
  mermaid: FileText,
};

const categoryColors: Record<string, string> = {
  Reports: "bg-chart-1/20 text-chart-1",
  Technical: "bg-chart-2/20 text-chart-2",
  Design: "bg-chart-3/20 text-chart-3",
};

const CATEGORIES = ["Reports", "Technical", "Design"];

export function DocumentRow({
  filteredDocs,
  userId,
  customerId,
}: {
  filteredDocs: any[];
  userId: string | undefined;
  // Kept for callers; documents no longer have an owner to reassign.
  customerId?: string;
}) {
  const updateMutation = useUpdateDocument();
  const deleteMutation = useDeleteDocument();
  const { profile } = useUser();
  const isAdmin = profile?.role === "admin";
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<any | null>(null);
  const [previewDoc, setPreviewDoc] = useState<PreviewableDoc | null>(null);
  // The document waiting for "Delete?" to be confirmed.
  const [confirmDelete, setConfirmDelete] = useState<any | null>(null);

  // Clicking a document's name previews it in-app for formats we know how to
  // render (markdown/text/csv); anything else falls back to the existing
  // "open in a new tab" behavior the ExternalLink button already used.
  const handleDocumentClick = (doc: any) => {
    if (PREVIEWABLE_FORMATS.has(doc.format)) {
      setPreviewDoc({ id: doc.id, name: doc.name, format: doc.format });
    } else {
      handleOpen(doc);
    }
  };

  // `user_id` here is checked against document_permissions.user_id, which is
  // keyed by portal.users.id — `userId` (this row's own prop, already
  // resolved to profile.id by documents-list.tsx) is that id. `user.id` from
  // useUser() is the raw Supabase Auth uid instead, a different id space
  // (see 20260921140000_fix_chat_rls_match_by_email.sql) that essentially
  // never matches a document_permissions row, which was making every
  // open/download/preview fail with a silent "No access" 403.
  const handleOpen = async (doc: any) => {
    if (!userId) return;
    try {
      setOpeningId(doc.id);
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/storage/download?document_id=${doc.id}&user_id=${userId}&inline=true`,
        { headers: API_HEADERS },
      );
      const { url } = await res.json();
      window.open(url, "_blank");
    } catch (err) {
      console.error(err);
    } finally {
      setOpeningId(null);
    }
  };

  const handleDownload = async (doc: any) => {
    if (!userId) return;
    try {
      setDownloadingId(doc.id);

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/storage/download?document_id=${doc.id}&user_id=${userId}`,
        { headers: API_HEADERS },
      );

      const { url } = await res.json();

      window.open(url, "_blank");
    } catch (err) {
      console.error(err);
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="space-y-2">
      <ShareDocumentModal
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        document={selectedDoc}
        id={userId}
      />

      <DocumentPreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)} />

      {filteredDocs.map((doc) => {
        const FormatIcon =
          formatIcons[doc.format as keyof typeof formatIcons] || File;
        const savingCategory =
          updateMutation.isPending && updateMutation.variables?.document_id === doc.id;
        // Access is yes or no: anyone with access (or an admin) can change
        // the category, share and delete.
        const canManage = !!doc.permission || isAdmin;

        return (
          <div
            key={doc.id}
            className="flex gap-3 sm:items-center rounded-lg border border-border/60 bg-muted/30 sm:border-transparent sm:bg-background hover:bg-muted transition-colors group"
          >
            {/* Icon — small screens: fills the row's full height at ~20%
                width (self-stretch from the outer flex-row's default
                align-items) instead of a small fixed box, since it's now the
                only thing on the left. sm+ reverts to the original 40px
                inline icon. */}
            <div className="flex w-1/5 sm:w-10 sm:h-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <FormatIcon className="h-6 w-6 sm:h-5 sm:w-5 text-primary" />
            </div>

            {/* Right side — small screens: title/meta stacked above the
                action buttons. sm+: title/meta inline on the left, buttons
                pushed to the far right via justify-between, matching the
                original layout. */}
            <div className="flex-1 min-w-0 flex flex-col gap-2 py-2 sm:py-0 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <button
                  type="button"
                  onClick={() => handleDocumentClick(doc)}
                  className="block max-w-full smalltext font-medium text-foreground group-hover:text-primary transition-colors truncate text-left hover:underline"
                  aria-label={
                    PREVIEWABLE_FORMATS.has(doc.format) ? `Preview ${doc.name}` : `Open ${doc.name}`
                  }
                >
                  {doc.name}
                </button>

                <div className="flex items-center gap-2 smalltext text-muted-foreground flex-wrap">
                  <Badge
                    variant="secondary"
                    className={`smalltext ${
                      categoryColors[doc.category] ?? "bg-muted text-foreground"
                    }`}
                  >
                    {doc.category}
                  </Badge>
                  <span>•</span>
                  <Calendar className="h-3 w-3" />
                  <span>{doc.date}</span>
                  {/* File size — dropped on small screens, kept at sm+. */}
                  <span className="hidden sm:inline">•</span>
                  <span className="hidden sm:inline">{doc.size}</span>
                </div>
              </div>

              {/* Actions — always visible on touch screens (no hover state
                  to reveal them); hover-revealed only at sm: and up. On
                  small screens this stretches full-width as a 5-col grid
                  (the max shown, for an owner) so each button is a big,
                  easy-to-tap ~20% slice instead of a small cluster of icons
                  — same treatment as the admin/users cards. */}
              <div className="grid grid-cols-5 gap-1 w-full sm:w-auto sm:flex sm:items-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 transition-opacity">
                {/* Category settings */}

                {canManage && (
                  <InlineSelect
                    align="start"
                    contentClassName="w-40 p-1"
                    optionClassName="font-normal text-foreground hover:bg-muted"
                    options={CATEGORIES.map((category) => ({ value: category, label: category }))}
                    value={doc.category}
                    saving={savingCategory}
                    onSelect={(category) =>
                      updateMutation.mutate({
                        user_id: userId!,
                        category,
                        document_id: doc.id,
                      })
                    }
                    trigger={
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-10 w-full sm:h-8 sm:w-8 hover:text-primary"
                        disabled={savingCategory}
                        aria-busy={savingCategory}
                        aria-label={`Change category for ${doc.name}`}
                      >
                        {savingCategory ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Settings className="h-4 w-4" />
                        )}
                      </Button>
                    }
                  />
                )}

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-full sm:h-8 sm:w-8 hover:text-primary"
                  onClick={() => handleDocumentClick(doc)}
                  aria-label={
                    PREVIEWABLE_FORMATS.has(doc.format) ? `Preview ${doc.name}` : `Open ${doc.name}`
                  }
                >
                  <ExternalLink
                    className={cn(
                      "h-4 w-4",
                      openingId === doc.id && "animate-pulse",
                    )}
                  />
                </Button>

                {canManage && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-full sm:h-8 sm:w-8 hover:text-primary"
                    onClick={() => {
                      setSelectedDoc(doc);
                      setIsShareOpen(true);
                    }}
                    aria-label={`Share ${doc.name}`}
                  >
                    <Share2 className="h-4 w-4" />
                  </Button>
                )}

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-full sm:h-8 sm:w-8 hover:text-primary"
                  onClick={() => handleDownload(doc)}
                  aria-label={`Download ${doc.name}`}
                >
                  <Download
                    className={cn(
                      "h-4 w-4",
                      downloadingId === doc.id && "animate-pulse",
                    )}
                  />{" "}
                </Button>

                {canManage && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-full sm:h-8 sm:w-8 text-destructive hover:text-destructive"
                    disabled={deleteMutation.isPending}
                    onClick={() => setConfirmDelete(doc)}
                    aria-label={`Delete ${doc.name}`}
                  >
                    {deleteMutation.isPending && deleteMutation.variables?.document_id === doc.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                )}

              </div>
            </div>
          </div>
        );
      })}

      {/* Soft delete: gone for everyone with access, but the file is kept. */}
      <Dialog open={!!confirmDelete} onOpenChange={(open) => !open && setConfirmDelete(null)}>
        <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Delete document?</DialogTitle>
          </DialogHeader>
          <p className="smalltext text-muted-foreground">
            <span className="font-medium text-foreground">{confirmDelete?.name}</span> will be removed for everyone
            who has access to it.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() =>
                deleteMutation.mutate(
                  { document_id: confirmDelete.id, user_id: userId! },
                  { onSettled: () => setConfirmDelete(null) },
                )
              }
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
