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
import { API_HEADERS } from "@/lib/api-headers";

const formatIcons: Record<string, any> = {
  pdf: FileText,
  png: FileImage,
  jpg: FileImage,
  docx: FileText,
  xlsx: FileSpreadsheet,
  zip: File,
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
}: {
  filteredDocs: any[];
  userId: string | undefined;
}) {
  const updateMutation = useUpdateDocument();
  const deleteMutation = useDeleteDocument();
  const { user, profile } = useUser();
  const isAdmin = profile?.role === "admin";
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<any | null>(null);

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

      {filteredDocs.map((doc) => {
        const FormatIcon =
          formatIcons[doc.format as keyof typeof formatIcons] || File;

        return (
          <div
            key={doc.id}
            className="flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-between rounded-lg border border-transparent bg-background hover:bg-muted transition-colors group"
          >
            {/* Left */}
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <FormatIcon className="h-5 w-5 text-primary" />
              </div>

              <div className="min-w-0">
                <p className="smalltext font-medium text-foreground group-hover:text-primary transition-colors truncate">
                  {doc.name}
                </p>

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
                  <span>•</span>
                  <span>{doc.size}</span>
                </div>
              </div>
            </div>

            {/* Actions — always visible on touch screens (no hover state to
                reveal them); hover-revealed only at sm: and up. */}
            <div className="flex items-center gap-1 self-end sm:self-auto opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 transition-opacity">
              {/* Category settings */}

              {["write", "owner"].includes(doc.permission) && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 hover:text-primary"
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
                className="h-8 w-8 hover:text-primary"
                onClick={() => handleOpen(doc)}
                aria-label={`Open ${doc.name}`}
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
                  className="h-8 w-8 hover:text-primary"
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
                className="h-8 w-8 hover:text-primary"
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

              {doc.permission === "owner" && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
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
            </div>
          </div>
        );
      })}
    </div>
  );
}
