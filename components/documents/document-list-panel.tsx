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
  const { user } = useUser();
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<any | null>(null);

  const handleOpen = async (doc: any) => {
    try {
      setOpeningId(doc.id);
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_ENDPOINT}/storage/download?document_id=${doc.id}&user_id=${user.id}&inline=true`,
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
        `${process.env.NEXT_PUBLIC_ENDPOINT}/storage/download?document_id=${doc.id}&user_id=${user.id}`,
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
            className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 p-3 hover:bg-secondary/50 transition-colors group"
          >
            {/* Left */}
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                <FormatIcon className="h-5 w-5 text-muted-foreground" />
              </div>

              <div>
                <p className="text-sm font-medium text-card-foreground group-hover:text-accent transition-colors">
                  {doc.name}
                </p>

                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge
                    variant="secondary"
                    className={
                      categoryColors[doc.category] ?? "bg-muted text-foreground"
                    }
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

            {/* Actions */}
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {/* Category settings */}

              {doc.permission === "write" && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
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
                          "w-full justify-start text-sm",
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
                className="h-8 w-8"
                onClick={() => handleOpen(doc)}
              >
                <ExternalLink
                  className={cn(
                    "h-4 w-4",
                    openingId === doc.id && "animate-pulse",
                  )}
                />
              </Button>

              {doc.permission === "write" && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => {
                    setSelectedDoc(doc);
                    setIsShareOpen(true);
                  }}
                >
                  <Share2 className="h-4 w-4" />
                </Button>
              )}

              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => handleDownload(doc)}
              >
                <Download
                  className={cn(
                    "h-4 w-4",
                    downloadingId === doc.id && "animate-pulse",
                  )}
                />{" "}
              </Button>

              {doc.permission === "write" && (
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
