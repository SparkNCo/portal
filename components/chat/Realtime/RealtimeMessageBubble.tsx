"use client";

import { MessageAvatar } from "../CometChat/MessageAvatar";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase-client";
import {
  CHAT_ATTACHMENTS_BUCKET,
  messageAttachments,
  type ChatMessage,
  type StoredChatAttachment,
} from "./useRealtimeMessages";
import { HoverTime, LastMessageTime } from "../MessageTime";
import { ChatAttachmentView } from "../ChatAttachmentView";

// The bucket is private: each file is shown through a short-lived signed URL
// (cached a bit under its lifetime).
function SignedAttachment({
  attachment,
  isMe,
  compact,
}: {
  readonly attachment: StoredChatAttachment;
  readonly isMe: boolean;
  readonly compact: boolean;
}) {
  const { data: url, isError } = useQuery({
    queryKey: ["chat-attachment-url", attachment.path],
    queryFn: async () => {
      const { data, error } = await supabase.storage
        .from(CHAT_ATTACHMENTS_BUCKET)
        .createSignedUrl(attachment.path, 60 * 60);
      if (error) throw error;
      return data.signedUrl;
    },
    staleTime: 50 * 60 * 1000,
  });

  if (isError) return <p className="smalltext text-destructive">Couldn't load {attachment.name}</p>;
  if (!url) return <div className="h-10 w-40 rounded-xl bg-muted/40 animate-pulse" aria-label={`Loading ${attachment.name}`} />;
  return (
    <ChatAttachmentView
      attachment={{ url, name: attachment.name, mimeType: attachment.mimeType, size: attachment.size }}
      isMe={isMe}
      compact={compact}
    />
  );
}

export function RealtimeMessageBubble({
  msg,
  currentUserId,
  senderName,
  compact = false,
  isLast = false,
  continuesGroup = false,
}: {
  readonly msg: ChatMessage;
  readonly currentUserId: string;
  readonly senderName: string;
  readonly compact?: boolean;
  /** The newest message shows its time; the rest only on hover. */
  readonly isLast?: boolean;
  /** Same sender as the message right above: no avatar or name, sits closer. */
  readonly continuesGroup?: boolean;
}) {
  const isMe = msg.user_id === currentUserId;
  const sentDate = new Date(msg.created_at);
  const attachments = messageAttachments(msg);

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
          <MessageAvatar name={senderName} className={compact ? "w-6 h-6 smalltext" : undefined} />
        ))}
      <div className={`flex flex-col ${compact ? "max-w-[70%]" : "max-w-[65%]"} ${isMe ? "items-end" : "items-start"}`}>
        {!isMe && !continuesGroup && (
          <span className={`smalltext ${compact ? "mb-0.5" : "mb-1"} text-muted-foreground px-1`}>
            {senderName}
          </span>
        )}
        <div className={`flex items-end gap-1.5 max-w-full ${isMe ? "flex-row-reverse" : "flex-row"}`}>
          <div className={`min-w-0 flex flex-col gap-1 ${isMe ? "items-end" : "items-start"}`}>
            {attachments.map((a) => (
              <SignedAttachment key={a.path} attachment={a} isMe={isMe} compact={compact} />
            ))}
            {msg.body && (
              <div
                className={`min-w-0 smalltext ${compact ? "px-2.5 py-1.5 rounded-xl" : "px-3 py-2 rounded-2xl"} ${
                  isMe
                    ? "bg-primary text-primary-foreground rounded-tr-sm"
                    : "bg-secondary text-secondary-foreground rounded-tl-sm"
                }`}
              >
                {msg.body}
              </div>
            )}
          </div>
          {!isLast && <HoverTime date={sentDate} />}
        </div>
        {isLast && <LastMessageTime date={sentDate} className={compact ? "mt-0.5" : "mt-1"} />}
      </div>
    </div>
  );
}
