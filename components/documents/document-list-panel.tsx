"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
  UserCog,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useDeleteDocument, useUpdateDocument } from "./update-document-entry";
import { useUser } from "context/UserContext";
import { Share2 } from "lucide-react";
import { ShareDocumentModal } from "./ShareDocumentModal";
import { API_HEADERS, API_JSON_HEADERS } from "@/lib/api-headers";
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
  // The initiative whose assigned users can be picked as a new document
  // owner (admin-only) — same id StaffingSection/StakeholdersSection use to
  // scope their own `GET /assignments?customer_id=` calls.
  customerId?: string;
}) {
  const updateMutation = useUpdateDocument();
  const deleteMutation = useDeleteDocument();
  const queryClient = useQueryClient();
  const { user, profile } = useUser();
  const isAdmin = profile?.role === "admin";
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<any | null>(null);
  const [previewDoc, setPreviewDoc] = useState<PreviewableDoc | null>(null);

  // Only fetched when an admin actually opens the Owner popover on some row
  // (enabled below, per-row) — no point loading this for every visitor.
  const assignedUsersQuery = useQuery({
    queryKey: ["assignments", customerId],
    queryFn: async () => {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/assignments?customer_id=${customerId}`,
        { headers: API_HEADERS },
      );
      if (!res.ok) throw new Error("Failed to fetch initiative users");
      return res.json() as Promise<any[]>;
    },
    enabled: isAdmin && !!customerId,
  });

  const transferOwnerMutation = useMutation({
    mutationFn: async ({ documentId, newOwnerId }: { documentId: string; newOwnerId: string }) => {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/storage/transfer-owner`,
        {
          method: "POST",
          headers: API_JSON_HEADERS,
          body: JSON.stringify({ document_id: documentId, new_owner_id: newOwnerId, user_id: userId }),
        },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Failed to change owner");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
  });

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

  const handleOpen = async (doc: any) => {
    try {
      setOpeningId(doc.id);
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/storage/download?document_id=${doc.id}&user_id=${user.id}&inline=true`,
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
    try {
      setDownloadingId(doc.id);

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/storage/download?document_id=${doc.id}&user_id=${user.id}`,
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

                {["write", "owner"].includes(doc.permission) && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-10 w-full sm:h-8 sm:w-8 hover:text-primary"
                        aria-label={`Change category for ${doc.name}`}
                      >
                        <Settings className="h-4 w-4" />
                      </Button>
                    </PopoverTrigger>

                    <PopoverContent className="w-40 p-1">
                      {CATEGORIES.map((category) => (
                        <Button
                          key={category}
                          variant="ghost"
                          size="sm"
                          className={cn(
                            "w-full justify-start smalltext",
                            doc.category === category &&
                              "bg-secondary font-medium",
                          )}
                          onClick={() =>
                            updateMutation.mutate({
                              user_id: user.id,
                              category,
                              document_id: doc.id,
                            })
                          }
                        >
                          {category}
                        </Button>
                      ))}
                    </PopoverContent>
                  </Popover>
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

                {(["write", "owner"].includes(doc.permission) || isAdmin) && (
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

                {(doc.permission === "owner" || isAdmin) && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-full sm:h-8 sm:w-8 text-destructive hover:text-destructive"
                    disabled={deleteMutation.isPending}
                    onClick={() =>
                      deleteMutation.mutate({
                        document_id: doc.id,
                        user_id: user.id,
                      })
                    }
                    aria-label={`Delete ${doc.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}

                {/* Admin-only: reassign this document's owner to any user
                    assigned to the initiative — e.g. the original uploader
                    left the company and someone else needs delete/share
                    rights over what they left behind. */}
                {isAdmin && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-10 w-full sm:h-8 sm:w-8 hover:text-primary"
                        aria-label={`Change owner for ${doc.name}`}
                      >
                        <UserCog className="h-4 w-4" />
                      </Button>
                    </PopoverTrigger>

                    <PopoverContent className="w-56 p-1">
                      {assignedUsersQuery.isLoading && (
                        <p className="smalltext text-muted-foreground px-2 py-1.5">
                          Loading…
                        </p>
                      )}
                      {!assignedUsersQuery.isLoading &&
                        (assignedUsersQuery.data?.length ?? 0) === 0 && (
                          <p className="smalltext text-muted-foreground px-2 py-1.5">
                            No assigned users found.
                          </p>
                        )}
                      {assignedUsersQuery.data
                        ?.filter((a: any) => a.role !== "stakeholder")
                        .map((assignment: any) => (
                          <Button
                            key={assignment.user_id}
                            variant="ghost"
                            size="sm"
                            disabled={transferOwnerMutation.isPending}
                            className="w-full justify-start smalltext truncate"
                            onClick={() =>
                              transferOwnerMutation.mutate({
                                documentId: doc.id,
                                newOwnerId: assignment.user_id,
                              })
                            }
                          >
                            {assignment.firstName
                              ? `${assignment.firstName} ${assignment.lastName ?? ""}`.trim()
                              : assignment.userName || assignment.email}
                          </Button>
                        ))}
                    </PopoverContent>
                  </Popover>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
