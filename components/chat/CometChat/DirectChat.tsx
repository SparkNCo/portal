"use client";

import { useEffect, useRef, useState } from "react";
import { CometChat } from "@cometchat/chat-sdk-javascript";
import { Send, Bot } from "lucide-react";

type Props = Readonly<{
  user: CometChat.User;
  receiverUID: string;
  title: string;
}>;

function dedupeAppend(prev: any[], msg: CometChat.TextMessage): any[] {
  const msgId = msg.getId?.();
  if (msgId && prev.some((m) => m.getId?.() === msgId)) return prev;
  return [...prev, msg];
}

export default function DirectChat({ user, receiverUID, title }: Props) {
  const [messages, setMessages] = useState<any[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchMessages();
  }, [receiverUID]);

  useEffect(() => {
    const myUID = user.getUid();
    const listenerId = `direct-chat-${receiverUID}`;

    const appendIncoming = (msg: CometChat.TextMessage) => {
      const fromUID = msg.getSender?.()?.getUid?.() ?? "";
      if (!fromUID || fromUID === myUID) return;
      setMessages((prev) => dedupeAppend(prev, msg));
    };

    CometChat.addMessageListener(
      listenerId,
      new CometChat.MessageListener({ onTextMessageReceived: appendIncoming }),
    );
    return () => {
      CometChat.removeMessageListener(listenerId);
    };
  }, [receiverUID, user]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const fetchMessages = async () => {
    try {
      setLoading(true);
      const req = new CometChat.MessagesRequestBuilder()
        .setUID(receiverUID)
        .setLimit(50)
        .build();
      const msgs = await req.fetchPrevious();
      setMessages(msgs);
    } catch (err) {
      console.error("Fetch direct messages error:", err);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!message.trim() || sending) return;
    setSending(true);
    try {
      const textMessage = new CometChat.TextMessage(
        receiverUID,
        message.trim(),
        CometChat.RECEIVER_TYPE.USER,
      );
      const sent = await CometChat.sendMessage(textMessage);
      setMessages((prev) => [...prev, sent]);
      setMessage("");
    } catch (err) {
      console.error("Send direct message error:", err);
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Loading messages...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b">
        <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center">
          <Bot className="w-4 h-4 text-accent" />
        </div>
        <div>
          <div className="text-sm font-semibold">{title}</div>
          <div className="text-xs text-muted-foreground">AI Agent</div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
            <Bot className="w-8 h-8 opacity-30" />
            <p className="text-sm">No messages yet. Ask the AI something!</p>
          </div>
        )}

        {messages.map((msg, i) => {
          const senderUid = msg.getSender?.()?.getUid?.() ?? msg.sender?.uid ?? "";
          const isMe = senderUid === user.getUid();
          const text = msg.getText?.() ?? msg.text ?? msg?.aiAssistantMessageData?.text;
          const sentAt: number | undefined = msg.getSentAt?.() ?? msg.sentAt;

          return (
            <div
              key={msg.getId?.() ?? i}
              className={`flex gap-2 ${isMe ? "flex-row-reverse" : "flex-row"}`}
            >
              {!isMe && (
                <div className="w-7 h-7 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Bot className="w-4 h-4 text-accent" />
                </div>
              )}
              <div className={`flex flex-col max-w-[65%] ${isMe ? "items-end" : "items-start"}`}>
                <div
                  className={`px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                    isMe
                      ? "bg-accent text-accent-foreground rounded-tr-sm"
                      : "bg-secondary text-secondary-foreground rounded-tl-sm"
                  }`}
                >
                  {text}
                </div>
                {!!sentAt && (
                  <span className="text-[10px] text-muted-foreground mt-1 px-1">
                    {new Date(sentAt * 1000).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                )}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t">
        <div className="flex items-center gap-2 bg-secondary/50 border rounded-xl px-3 py-2">
          <input
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Message the AI..."
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
          />
          <button
            onClick={sendMessage}
            disabled={!message.trim() || sending}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-accent text-accent-foreground disabled:opacity-40 hover:opacity-90 transition-opacity flex-shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
