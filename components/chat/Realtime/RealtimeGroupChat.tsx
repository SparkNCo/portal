"use client";

import { useEffect, useRef } from "react";
import { Send, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ChatSpinner } from "../CometChat/ChatSpinner";
import { RealtimeMessageBubble } from "./RealtimeMessageBubble";
import { useRealtimeMessages } from "./useRealtimeMessages";
import type { Chat } from "./useRealtimeChat";
import { useState } from "react";

export default function RealtimeGroupChat({
  chat,
  currentUserId,
  userNameById,
}: Readonly<{
  chat: Chat;
  currentUserId: string;
  userNameById: Map<string, string>;
}>) {
  const { messages, loading, sending, sendMessage } = useRealtimeMessages(chat.id);
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (!draft.trim() || sending) return;
    sendMessage(draft);
    setDraft("");
  };

  if (loading) return <ChatSpinner label="Loading messages..." />;

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

        {messages.map((msg) => (
          <RealtimeMessageBubble
            key={msg.id}
            msg={msg}
            currentUserId={currentUserId}
            senderName={(msg.user_id && userNameById.get(msg.user_id)) ?? "Unknown"}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="h-[72px] flex items-center px-4 border-t">
        <div className="w-full flex items-center gap-2 bg-secondary border rounded-xl px-3 py-2">
          <div className="min-w-0 flex-1">
            <Input
              aria-label="Type a message"
              className="h-auto border-0 bg-transparent px-0 py-0 shadow-none focus-visible:ring-0 smalltext text-secondary-foreground placeholder:text-secondary-foreground/40"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Type a message..."
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            />
          </div>
          <button
            onClick={handleSend}
            disabled={!draft.trim() || sending}
            aria-label="Send message"
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-primary text-primary-foreground disabled:opacity-40 hover:opacity-90 transition-opacity flex-shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
