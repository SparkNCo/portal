"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Eye, File as FileIcon, X } from "lucide-react";
import { Button } from "@/components/components/ui/button";
import {
  FilePreviewModal,
  PREVIEWABLE_FORMATS,
  docxToHtml,
} from "@/components/documents/document-preview-modal";

const IMAGE_FILE = /\.(png|jpe?g|gif|webp|svg|avif)$/i;
const PDF_FILE = /\.pdf$/i;

function extensionOf(name: string): string {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

// How a picked file can be viewed: in the in-app preview (text formats,
// Word, images), in a new tab (PDF — the browser's own viewer), or not at all.
function viewModeOf(file: File): { format: string } | "tab" | null {
  if (IMAGE_FILE.test(file.name)) return { format: "image" };
  const ext = extensionOf(file.name);
  if (PREVIEWABLE_FORMATS.has(ext)) return { format: ext };
  if (PDF_FILE.test(file.name)) return "tab";
  return null;
}

// The files picked in the Request a Feature / Report a Bug panels, before
// they're uploaded. Each viewable one has an eye icon and opens with a single
// tap/click: images, markdown, text, CSV, mermaid and Word in the in-app
// preview (no new tab — that's unreliable on phones), PDFs in a new tab.
// Hovering a file turns it orange.
export function AttachedFilesList({
  files,
  onRemove,
}: Readonly<{
  files: File[];
  onRemove: (name: string) => void;
}>) {
  const [previewing, setPreviewing] = useState<{ file: File; format: string } | null>(null);
  const previewFile = useMemo(
    () => (previewing ? { name: previewing.file.name, format: previewing.format } : null),
    [previewing],
  );
  // An image preview shows the file through a temporary object URL.
  const objectUrlRef = useRef<string | null>(null);
  const releaseObjectUrl = () => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = null;
  };
  useEffect(() => releaseObjectUrl, []);

  if (files.length === 0) return null;

  const loadPreview = async () => {
    const { file, format } = previewing!;
    if (format === "image") {
      releaseObjectUrl();
      objectUrlRef.current = URL.createObjectURL(file);
      return objectUrlRef.current;
    }
    return format === "docx" ? docxToHtml(await file.arrayBuffer()) : file.text();
  };

  const openInNewTab = (file: File) => {
    const url = URL.createObjectURL(file);
    window.open(url, "_blank", "noopener,noreferrer");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  return (
    <div className="space-y-1.5 pt-1">
      {files.map((file) => {
        const mode = viewModeOf(file);
        return (
          <div
            key={file.name}
            className="flex items-center justify-between gap-2 rounded-lg border border-border bg-secondary/30 p-2"
          >
            {mode ? (
              <button
                type="button"
                onClick={() => (mode === "tab" ? openInNewTab(file) : setPreviewing({ file, format: mode.format }))}
                aria-label={`Preview ${file.name}`}
                className="group flex min-w-0 flex-1 items-center gap-2 text-left"
              >
                <FileIcon className="h-4 w-4 flex-shrink-0 text-muted-foreground group-hover:text-primary" />
                <span className="smalltext truncate group-hover:text-primary transition-colors">{file.name}</span>
                <Eye className="ml-auto h-4 w-4 flex-shrink-0 text-muted-foreground group-hover:text-primary" aria-hidden="true" />
              </button>
            ) : (
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <FileIcon className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                <span className="smalltext truncate">{file.name}</span>
              </div>
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6 flex-shrink-0"
              onClick={() => onRemove(file.name)}
              aria-label={`Remove ${file.name}`}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        );
      })}

      <FilePreviewModal
        file={previewFile}
        loadText={loadPreview}
        onClose={() => {
          setPreviewing(null);
          releaseObjectUrl();
        }}
      />
    </div>
  );
}
