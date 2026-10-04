"use client";

import { Fragment, useEffect, useRef } from "react";
import { Users } from "lucide-react";
import { ChatComposer } from "../ChatComposer";
import { ChatSpinner } from "../CometChat/ChatSpinner";
import { RealtimeMessageBubble } from "./RealtimeMessageBubble";
import { DateDivider, markDayStarts } from "../DateDivider";
import { useRealtimeMessages } from "./useRealtimeMessages";
import type { Chat } from "./useRealtimeChat";

export default function RealtimeGroupChat({
  chat,
  currentUserId,
  userNameById,
}: Readonly<{
  chat: Chat;
  currentUserId: string;
  userNameById: Map<string, string>;
}>) {
  const { messages, loading, sendMessage } = useRealtimeMessages(chat.id);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (loading) return <ChatSpinner label="Loading messages..." />;

  const dayStarts = markDayStarts(messages, (msg) => new Date(msg.created_at));

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-background">
      <div className="flex items-center gap-3 px-4 py-3 border-b">
        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
          <Users className="w-4 h-4 text-primary" />
        </div>
        <div>
          <div className="smalltext font-semibold">{chat.title ?? "Chat"}</div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
            <Users className="w-8 h-8 opacity-30" />
            <p className="text-sm md:smalltext">No messages yet. Say hello!</p>
          </div>
        )}

        {messages.map((msg, i) => (
          <Fragment key={msg.id}>
            {dayStarts[i] && <DateDivider date={dayStarts[i]} />}
            <RealtimeMessageBubble
              msg={msg}
              currentUserId={currentUserId}
              senderName={(msg.user_id && userNameById.get(msg.user_id)) ?? "Unknown"}
              isLast={i === messages.length - 1}
              continuesGroup={i > 0 && !dayStarts[i] && messages[i - 1]?.user_id === msg.user_id}
            />
          </Fragment>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="px-4 py-3 border-t">
        <ChatComposer onSend={sendMessage} />
      </div>
    </div>
  );
}
