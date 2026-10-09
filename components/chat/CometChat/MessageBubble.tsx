"use client";

import { CometChat } from "@cometchat/chat-sdk-javascript";
import { MessageAvatar } from "./MessageAvatar";
import { extractChatMessage } from "./chatUtils";
import { ChatAttachmentView } from "../ChatAttachmentView";
import { HoverTime, LastMessageTime } from "../MessageTime";

export function MessageBubble({
  msg,
  index,
  user,
  compact = false,
  isLast = false,
  continuesGroup = false,
}: {
  readonly msg: any;
  readonly index: number;
  readonly user: CometChat.User;
  readonly compact?: boolean;
  /** The newest message shows its time; the rest only on hover. */
  readonly isLast?: boolean;
  /** Same sender as the message right above: no avatar or name, sits closer. */
  readonly continuesGroup?: boolean;
}) {
  const data = extractChatMessage(msg, index);
  if (!data) return null;

  const { senderUid, senderName, text, sentAt, attachment } = data;
  const isMe = senderUid === user.getUid();
  // CometChat's sentAt is in seconds; missing while still sending.
  const sentDate = sentAt ? new Date(sentAt * 1000) : null;

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
      <div className={`flex flex-col ${compact ? "max-w-[70%]" : "max-w-[65%]"} ${isMe ? "items-end" : "items-start"}`}>
        {!isMe && !continuesGroup && (
          <span className={`smalltext ${compact ? "mb-0.5" : "mb-1"} text-muted-foreground px-1`}>
            {senderName}
          </span>
        )}
        <div className={`flex items-end gap-1.5 max-w-full ${isMe ? "flex-row-reverse" : "flex-row"}`}>
          {attachment ? (
            <div className="min-w-0 space-y-1">
              <ChatAttachmentView attachment={attachment} isMe={isMe} compact={compact} />
              {text && (
                <div className={`smalltext px-1 ${isMe ? "text-right" : ""}`}>{text}</div>
              )}
            </div>
          ) : (
            <div
              className={`min-w-0 smalltext ${compact ? "px-2.5 py-1.5 rounded-xl" : "px-3 py-2 rounded-2xl"} ${
                isMe
                  ? "bg-primary text-primary-foreground rounded-tr-sm"
                  : "bg-secondary text-secondary-foreground rounded-tl-sm"
              }`}
            >
              {text}
            </div>
          )}
          {sentDate && !isLast && <HoverTime date={sentDate} />}
        </div>
        {sentDate && isLast && (
          <LastMessageTime date={sentDate} className={compact ? "mt-0.5" : "mt-1"} />
        )}
      </div>
    </div>
  );
}
