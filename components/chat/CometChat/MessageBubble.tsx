"use client";

import { CometChat } from "@cometchat/chat-sdk-javascript";
import { MessageAvatar } from "./MessageAvatar";
import { extractChatMessage, formatMessageTime } from "./chatUtils";

export function MessageBubble({
  msg,
  index,
  user,
  compact = false,
}: {
  readonly msg: any;
  readonly index: number;
  readonly user: CometChat.User;
  readonly compact?: boolean;
}) {
  const data = extractChatMessage(msg, index);
  if (!data) return null;

  const { senderUid, senderName, text, sentAt } = data;
  const isMe = senderUid === user.getUid();

  return (
    <div className={`flex ${compact ? "gap-1.5" : "gap-2"} ${isMe ? "flex-row-reverse" : "flex-row"}`}>
      {!isMe && (
        <MessageAvatar
          name={senderName}
          className={compact ? "w-6 h-6 smalltext" : undefined}
        />
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
          {text}
        </div>
        {!!sentAt && (
          <span className={`smalltext ${compact ? "mt-0.5" : "mt-1"} text-muted-foreground px-1`}>
            {formatMessageTime(sentAt)}
          </span>
        )}
      </div>
    </div>
  );
}
