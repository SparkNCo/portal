"use client";

import { MessageAvatar } from "../CometChat/MessageAvatar";
import type { ChatMessage } from "./useRealtimeMessages";

function formatMessageTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function RealtimeMessageBubble({
  msg,
  currentUserId,
  senderName,
  compact = false,
}: {
  readonly msg: ChatMessage;
  readonly currentUserId: string;
  readonly senderName: string;
  readonly compact?: boolean;
}) {
  const isMe = msg.user_id === currentUserId;

  return (
    <div className={`flex ${compact ? "gap-1.5" : "gap-2"} ${isMe ? "flex-row-reverse" : "flex-row"}`}>
      {!isMe && (
        <MessageAvatar name={senderName} className={compact ? "w-6 h-6 smalltext" : undefined} />
      )}
      <div className={`flex flex-col ${compact ? "max-w-[70%]" : "max-w-[65%]"} ${isMe ? "items-end" : "items-start"}`}>
        {!isMe && (
          <span className={`smalltext ${compact ? "mb-0.5" : "mb-1"} text-muted-foreground px-1`}>
            {senderName}
          </span>
        )}
        <div
          className={`smalltext ${compact ? "px-2.5 py-1.5 rounded-xl" : "px-3 py-2 rounded-2xl"} ${
            isMe
              ? "bg-primary text-primary-foreground rounded-tr-sm"
              : "bg-secondary text-secondary-foreground rounded-tl-sm"
          }`}
        >
          {msg.body}
        </div>
        <span className={`smalltext ${compact ? "mt-0.5" : "mt-1"} text-muted-foreground px-1`}>
          {formatMessageTime(msg.created_at)}
        </span>
      </div>
    </div>
  );
}
