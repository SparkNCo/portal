"use client";

import { Download, FileText } from "lucide-react";
import { formatFileSize } from "./ChatComposer";

export type ChatAttachmentData = {
  url: string;
  name: string;
  mimeType: string;
  size?: number;
};

// A file inside a chat message: images inline (click to open full size),
// anything else as a card that opens/downloads it.
export function ChatAttachmentView({
  attachment,
  isMe,
  compact = false,
}: {
  readonly attachment: ChatAttachmentData;
  readonly isMe: boolean;
  readonly compact?: boolean;
}) {
  if (attachment.mimeType.startsWith("image/")) {
    return (
      <a href={attachment.url} target="_blank" rel="noopener noreferrer" className="block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={attachment.url}
          alt={attachment.name}
          loading="lazy"
          className={`${compact ? "max-h-48" : "max-h-72"} max-w-full rounded-xl border border-border object-contain bg-muted/40`}
        />
      </a>
    );
  }

  return (
    <a
      href={attachment.url}
      target="_blank"
      rel="noopener noreferrer"
      download={attachment.name}
      className={`flex items-center gap-2.5 rounded-xl border px-3 py-2 transition-colors max-w-xs ${
        isMe
          ? "bg-primary text-primary-foreground border-primary hover:opacity-90"
          : "bg-secondary text-secondary-foreground border-border hover:bg-secondary/80"
      }`}
    >
      <FileText className="h-5 w-5 shrink-0" />
      <span className="min-w-0 flex-1">
        <span className="block truncate smalltext font-medium">{attachment.name}</span>
        {attachment.size != null && (
          <span className="block smalltext opacity-70">{formatFileSize(attachment.size)}</span>
        )}
      </span>
      <Download className="h-4 w-4 shrink-0 opacity-70" />
    </a>
  );
}
