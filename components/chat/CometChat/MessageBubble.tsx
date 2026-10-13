"use client";

import { useState } from "react";
import { CometChat } from "@cometchat/chat-sdk-javascript";
import { Ban, Check, Loader2, Pencil, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { MessageAvatar } from "./MessageAvatar";
import { deleteOwnMessage, editTextMessage, extractChatMessage } from "./chatUtils";
import { ChatAttachmentView } from "../ChatAttachmentView";
import { HoverTime, LastMessageTime } from "../MessageTime";

const ACTION_BUTTON =
  "rounded p-1 text-muted-foreground hover:text-primary hover:bg-secondary/60 transition-colors disabled:opacity-50";

export function MessageBubble({
  msg,
  index,
  user,
  compact = false,
  isLast = false,
  continuesGroup = false,
  onMessageChanged,
}: {
  readonly msg: any;
  readonly index: number;
  readonly user: CometChat.User;
  readonly compact?: boolean;
  /** The newest message shows its time; the rest only on hover. */
  readonly isLast?: boolean;
  /** Same sender as the message right above: no avatar or name, sits closer. */
  readonly continuesGroup?: boolean;
  /**
   * Lets the user edit (text only) and delete their own messages; called with
   * the message as CometChat returns it afterwards. Without it, read-only.
   */
  readonly onMessageChanged?: (updated: any) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  const data = extractChatMessage(msg, index);
  if (!data) return null;

  const { senderUid, senderName, text, sentAt, attachment, edited, deleted } = data;
  const isMe = senderUid === user.getUid();
  // CometChat's sentAt is in seconds; missing while still sending.
  const sentDate = sentAt ? new Date(sentAt * 1000) : null;
  // Own, already-sent messages only. Attachments can be deleted, not edited.
  const canChange = !!onMessageChanged && isMe && !deleted && !!sentAt;
  const canEdit = canChange && !attachment;

  const startEditing = () => {
    setDraft(text);
    setConfirmingDelete(false);
    setEditing(true);
  };

  const saveEdit = async () => {
    const next = draft.trim();
    if (!next || next === text) {
      setEditing(false);
      return;
    }
    setBusy(true);
    try {
      onMessageChanged?.(await editTextMessage(msg, next));
      setEditing(false);
    } catch (err) {
      console.error("Edit message error:", err);
      toast.error("Couldn't edit the message. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    setBusy(true);
    try {
      onMessageChanged?.(await deleteOwnMessage(msg));
      setConfirmingDelete(false);
    } catch (err) {
      console.error("Delete message error:", err);
      toast.error("Couldn't delete the message. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const bubbleShape = compact ? "px-2.5 py-1.5 rounded-xl" : "px-3 py-2 rounded-2xl";
  const bubbleColor = isMe
    ? "bg-primary text-primary-foreground rounded-tr-sm"
    : "bg-secondary text-secondary-foreground rounded-tl-sm";

  let body: React.ReactNode;
  if (deleted) {
    body = (
      <div
        className={`min-w-0 smalltext italic text-muted-foreground border border-dashed border-border flex items-center gap-1.5 ${bubbleShape}`}
      >
        <Ban className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        This message was deleted
      </div>
    );
  } else if (editing) {
    body = (
      <div className="min-w-0 flex-1 space-y-1">
        <textarea
          aria-label="Edit message"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              saveEdit();
            } else if (e.key === "Escape") {
              // Don't let Escape also close a surrounding dialog (ticket chat).
              e.stopPropagation();
              setEditing(false);
            }
          }}
          rows={Math.min(6, Math.max(1, draft.split("\n").length))}
          autoFocus
          disabled={busy}
          className="w-full min-w-[12rem] resize-none rounded-lg border border-primary bg-background px-2.5 py-1.5 smalltext text-foreground focus:outline-none"
        />
        <div className="flex justify-end gap-1">
          <button type="button" onClick={() => setEditing(false)} disabled={busy} className={ACTION_BUTTON} aria-label="Cancel edit">
            <X className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={saveEdit}
            disabled={busy || !draft.trim()}
            className={ACTION_BUTTON}
            aria-label="Save edit"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>
    );
  } else if (attachment) {
    body = (
      <div className="min-w-0 space-y-1">
        <ChatAttachmentView attachment={attachment} isMe={isMe} compact={compact} />
        {text && <div className={`smalltext px-1 ${isMe ? "text-right" : ""}`}>{text}</div>}
      </div>
    );
  } else {
    body = <div className={`min-w-0 smalltext whitespace-pre-wrap break-words ${bubbleShape} ${bubbleColor}`}>{text}</div>;
  }

  // Shown on hover on desktop; always there on touch screens (no hover).
  const actions = canChange && !editing && (
    <div
      className={`flex shrink-0 items-center self-center ${
        confirmingDelete ? "" : "sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
      } transition-opacity`}
    >
      {confirmingDelete ? (
        <>
          <span className="smalltext text-muted-foreground px-1">Delete?</span>
          <button type="button" onClick={confirmDelete} disabled={busy} className={`${ACTION_BUTTON} hover:text-destructive`} aria-label="Confirm delete">
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          </button>
          <button type="button" onClick={() => setConfirmingDelete(false)} disabled={busy} className={ACTION_BUTTON} aria-label="Cancel delete">
            <X className="h-3.5 w-3.5" />
          </button>
        </>
      ) : (
        <>
          {canEdit && (
            <button type="button" onClick={startEditing} className={ACTION_BUTTON} aria-label="Edit message" title="Edit">
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            className={`${ACTION_BUTTON} hover:text-destructive`}
            aria-label="Delete message"
            title="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </>
      )}
    </div>
  );

  const editedMark = edited && !deleted && <span className="smalltext text-muted-foreground px-1">(edited)</span>;

  return (
    <div
      className={`group flex ${compact ? "gap-1.5" : "gap-2"} ${isMe ? "flex-row-reverse" : "flex-row"} ${
        continuesGroup ? "!mt-1" : ""
      }`}
    >
      {!isMe &&
        (continuesGroup ? (
          // Keeps the bubble aligned with the ones above.
          <div className={`${compact ? "w-6" : "w-7"} shrink-0`} aria-hidden="true" />
        ) : (
          <MessageAvatar
            name={senderName}
            className={compact ? "w-6 h-6 smalltext" : undefined}
          />
        ))}
      <div
        className={`flex flex-col ${editing ? "flex-1" : ""} ${compact ? "max-w-[70%]" : "max-w-[65%]"} ${
          isMe ? "items-end" : "items-start"
        }`}
      >
        {!isMe && !continuesGroup && (
          <span className={`smalltext ${compact ? "mb-0.5" : "mb-1"} text-muted-foreground px-1`}>
            {senderName}
          </span>
        )}
        <div className={`flex items-end gap-1.5 max-w-full ${editing ? "w-full" : ""} ${isMe ? "flex-row-reverse" : "flex-row"}`}>
          {body}
          {actions}
          {sentDate && !isLast && !editing && (
            <>
              {editedMark}
              <HoverTime date={sentDate} />
            </>
          )}
        </div>
        {sentDate && isLast && (
          <div className={`flex items-center ${compact ? "mt-0.5" : "mt-1"}`}>
            {editedMark}
            <LastMessageTime date={sentDate} />
          </div>
        )}
      </div>
    </div>
  );
}
