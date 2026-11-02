"use client";

import { useState } from "react";
import { Download, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatFileSize } from "./ChatComposer";

export type ChatAttachmentData = {
  url: string;
  name: string;
  mimeType: string;
  size?: number;
};

// Saves a chat file to the computer. The files live on another domain
// (CometChat's or Supabase's storage), where browsers ignore a link's
// `download` attribute and open the file instead — so fetch it and save the
// copy. If it can't be fetched (blocked cross-origin), open it as before.
async function downloadFile(attachment: ChatAttachmentData) {
  try {
    const res = await fetch(attachment.url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const objectUrl = URL.createObjectURL(await res.blob());
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = attachment.name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000);
  } catch (err) {
    console.error("Chat file download error:", err);
    toast("Couldn't download it directly — opening it instead.");
    window.open(attachment.url, "_blank", "noopener,noreferrer");
  }
}

// A file inside a chat message: images inline (click to open full size in a
// new tab), anything else as a card that downloads it.
export function ChatAttachmentView({
  attachment,
  isMe,
  compact = false,
}: {
  readonly attachment: ChatAttachmentData;
  readonly isMe: boolean;
  readonly compact?: boolean;
}) {
  const [downloading, setDownloading] = useState(false);

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
    <button
      type="button"
      disabled={downloading}
      onClick={async () => {
        setDownloading(true);
        await downloadFile(attachment);
        setDownloading(false);
      }}
      aria-label={`Download ${attachment.name}`}
      className={`flex items-center gap-2.5 rounded-xl border px-3 py-2 text-left transition-colors max-w-xs disabled:opacity-70 ${
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
      {downloading ? (
        <Loader2 className="h-4 w-4 shrink-0 animate-spin opacity-70" />
      ) : (
        <Download className="h-4 w-4 shrink-0 opacity-70" />
      )}
    </button>
  );
}
