"use client";

import { useEffect, useRef, useState } from "react";
import { CometChat } from "@cometchat/chat-sdk-javascript";
import { Send, Users } from "lucide-react";
import { ChatSpinner } from "./ChatSpinner";
import { MessageBubble } from "./MessageBubble";

type Props = Readonly<{
  user: CometChat.User;
  group: CometChat.Group;
}>;

export default function GroupChat({ user, group }: Props) {
  const [messages, setMessages] = useState<any[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const guid = group.getGuid();

  useEffect(() => {
    fetchMessages();
  }, [guid]);

  useEffect(() => {
    const listenerId = `group-chat-${guid}`;
    CometChat.addMessageListener(
      listenerId,
      new CometChat.MessageListener({
        onTextMessageReceived: (msg: CometChat.TextMessage) => {
          if (msg.getReceiverId() === guid) {
            setMessages((prev) => [...prev, msg]);
          }
        },
      }),
    );
    return () => {
      CometChat.removeMessageListener(listenerId);
    };
  }, [guid]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const fetchMessages = async () => {
    try {
      setLoading(true);
      if (!group.getHasJoined()) {
        await CometChat.joinGroup(guid, CometChat.GROUP_TYPE.PUBLIC as unknown as CometChat.GroupType, "");
      }
      const req = new CometChat.MessagesRequestBuilder()
        .setGUID(guid)
        .setLimit(50)
        .build();
      const msgs = await req.fetchPrevious();
      setMessages(msgs);
    } catch (err) {
      console.error("Fetch group messages error:", err);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!message.trim() || sending) return;
    setSending(true);
    try {
      const textMsg = new CometChat.TextMessage(
        guid,
        message.trim(),
        CometChat.RECEIVER_TYPE.GROUP,
      );
      const sent = await CometChat.sendMessage(textMsg);
      setMessages((prev) => [...prev, sent]);
      setMessage("");
    } catch (err) {
      console.error("Send group message error:", err);
    } finally {
      setSending(false);
    }
  };

  if (loading) return <ChatSpinner label="Loading messages..." />;

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b">
        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
          <Users className="w-4 h-4 text-primary" />
        </div>
        <div>
          <div className="text-sm font-semibold">{group.getName()}</div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
            <Users className="w-8 h-8 opacity-30" />
            <p className="text-sm">No messages yet. Say hello!</p>
          </div>
        )}

        {messages.map((msg, i) => (
          <MessageBubble key={msg.getId?.() ?? i} msg={msg} index={i} user={user} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t">
        <div className="flex items-center gap-2 bg-card/75 border rounded-xl px-3 py-2">
          <input
            aria-label="Type a message"
            className="flex-1 bg-transparent text-sm text-card-foreground outline-none placeholder:text-card-foreground/40"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type a message..."
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
          />
          <button
            onClick={sendMessage}
            disabled={!message.trim() || sending}
            aria-label="Send message"
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-accent text-accent-foreground disabled:opacity-40 hover:opacity-90 transition-opacity flex-shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
