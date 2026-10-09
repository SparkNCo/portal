"use client";

import { useEffect, useRef, useState } from "react";
import { FileText, Paperclip, Send, X } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";

// Per-file cap, checked in the browser before anything is uploaded.
export const MAX_CHAT_FILE_BYTES = 25 * 1024 * 1024;

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type Pending = { id: string; file: File; previewUrl: string | null };

// Pasted screenshots all arrive named "image.png" — give them a unique name.
function nameFile(file: File): File {
  if (file.name && file.name !== "image.png") return file;
  const ext = file.type.split("/")[1] || "png";
  return new File([file], `pasted-image-${Date.now()}.${ext}`, { type: file.type });
}

/**
 * Message input with attachments: a paperclip button, pasting images
 * (Ctrl/Cmd+V), and dropping files onto it. Picked files show above the input
 * until sent. `onSend` gets the text and the files; the composer clears only
 * when it resolves.
 */
export function ChatComposer({
  onSend,
  disabled = false,
  compact = false,
  placeholder = "Type a message...",
  inputId,
}: {
  readonly onSend: (text: string, files: File[]) => Promise<void>;
  readonly disabled?: boolean;
  readonly compact?: boolean;
  readonly placeholder?: string;
  readonly inputId?: string;
}) {
  const [text, setText] = useState("");
  const [pending, setPending] = useState<Pending[]>([]);
  const [sending, setSending] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Free the image previews when they go away.
  useEffect(
    () => () => pending.forEach((p) => p.previewUrl && URL.revokeObjectURL(p.previewUrl)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  function addFiles(files: File[]) {
    const accepted: Pending[] = [];
    files.forEach((raw) => {
      const file = nameFile(raw);
      if (file.size > MAX_CHAT_FILE_BYTES) {
        toast.error(`${file.name} is larger than ${formatFileSize(MAX_CHAT_FILE_BYTES)}.`);
        return;
      }
      accepted.push({
        id: `${file.name}-${file.size}-${Math.random().toString(36).slice(2)}`,
        file,
        previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : null,
      });
    });
    if (accepted.length) setPending((prev) => [...prev, ...accepted]);
  }

  function removePending(id: string) {
    setPending((prev) => {
      const gone = prev.find((p) => p.id === id);
      if (gone?.previewUrl) URL.revokeObjectURL(gone.previewUrl);
      return prev.filter((p) => p.id !== id);
    });
  }

  const canSend = !disabled && !sending && (text.trim().length > 0 || pending.length > 0);

  async function send() {
    if (!canSend) return;
    setSending(true);
    try {
      await onSend(text.trim(), pending.map((p) => p.file));
      pending.forEach((p) => p.previewUrl && URL.revokeObjectURL(p.previewUrl));
      setPending([]);
      setText("");
    } catch {
      toast.error("Couldn't send. Please try again.");
    } finally {
      setSending(false);
    }
  }

  const iconSize = compact ? "w-3 h-3" : "w-4 h-4";
  const buttonSize = compact ? "w-6 h-6 rounded-md" : "w-8 h-8 rounded-lg";

  return (
    <div
      className={`flex flex-col gap-2 rounded-xl border transition-colors ${
        compact ? "bg-card/90 border-border px-2.5 py-1.5" : "bg-secondary px-3 py-2"
      } ${dragging ? "border-primary ring-1 ring-primary" : ""}`}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        if (!e.dataTransfer.files.length) return;
        e.preventDefault();
        setDragging(false);
        addFiles(Array.from(e.dataTransfer.files));
      }}
    >
      {pending.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Attachments to send">
          {pending.map((p) => (
            <li
              key={p.id}
              className="relative flex items-center gap-2 rounded-lg border border-border bg-background p-1.5 pr-7 max-w-[220px]"
            >
              {p.previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.previewUrl} alt="" className="h-10 w-10 shrink-0 rounded object-cover" />
              ) : (
                <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
              )}
              <span className="min-w-0">
                <span className="block truncate smalltext text-foreground">{p.file.name}</span>
                <span className="block smalltext text-muted-foreground">{formatFileSize(p.file.size)}</span>
              </span>
              <button
                type="button"
                onClick={() => removePending(p.id)}
                disabled={sending}
                aria-label={`Remove ${p.file.name}`}
                className="absolute right-1 top-1 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className={`flex items-center ${compact ? "gap-1.5" : "gap-2"}`}>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || sending}
          aria-label="Attach files"
          title="Attach files (you can also paste or drop images)"
          className={`${buttonSize} flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 disabled:opacity-40 transition-colors flex-shrink-0`}
        >
          <Paperclip className={iconSize} />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            addFiles(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />
        <div className="min-w-0 flex-1">
          <Input
            id={inputId}
            aria-label="Type a message"
            className={`h-auto border-0 bg-transparent px-0 py-0 shadow-none focus-visible:ring-0 smalltext ${
              compact
                ? "text-card-foreground placeholder:text-card-foreground/40"
                : "text-secondary-foreground placeholder:text-secondary-foreground/40"
            }`}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onPaste={(e) => {
              const files = Array.from(e.clipboardData.files);
              if (files.length === 0) return;
              e.preventDefault();
              addFiles(files);
            }}
            placeholder={placeholder}
            disabled={disabled}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
          />
        </div>
        <button
          type="button"
          onClick={send}
          disabled={!canSend}
          aria-label="Send message"
          className={`${buttonSize} flex items-center justify-center bg-primary text-primary-foreground disabled:opacity-40 hover:opacity-90 transition-opacity flex-shrink-0`}
        >
          <Send className={iconSize} />
        </button>
      </div>
    </div>
  );
}
