"use client";

import { useEffect, useRef, useState } from "react";
import { CometChat } from "@cometchat/chat-sdk-javascript";
import { Send, Loader2 } from "lucide-react";
import { ChatSpinner } from "./ChatSpinner";
import { MessageBubble } from "./MessageBubble";

export function IssueGroupChat({
  user,
  group,
  onCreateGroup,
  onGroupCreated,
}: {
  readonly user: CometChat.User;
  readonly group: CometChat.Group | null;
  /** Creates the CometChat group (and adds all members) — only called when the first message is sent. */
  readonly onCreateGroup: () => Promise<CometChat.Group>;
  readonly onGroupCreated: (group: CometChat.Group) => void;
}) {
  const [messages, setMessages] = useState<any[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const guid = group?.getGuid();

  useEffect(() => {
    if (!guid) {
      setLoading(false);
      return;
    }
    fetchMessages(guid);
  }, [guid]);

  useEffect(() => {
    if (!guid) return;
    const listenerId = `issue-chat-${guid}`;
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
    return () => CometChat.removeMessageListener(listenerId);
  }, [guid]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const fetchMessages = async (activeGuid: string) => {
    try {
      setLoading(true);
      if (!group?.getHasJoined()) {
        await CometChat.joinGroup(
          activeGuid,
          CometChat.GROUP_TYPE.PUBLIC as unknown as CometChat.GroupType,
          "",
        );
      }
      const req = new CometChat.MessagesRequestBuilder()
        .setGUID(activeGuid)
        .setLimit(50)
        .build();
      const msgs = await req.fetchPrevious();
      setMessages(msgs);
    } catch (err) {
      console.error("Fetch issue messages error:", err);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!message.trim() || sending) return;
    setSending(true);
    try {
      let activeGuid = guid;
      if (!activeGuid) {
        const created = await onCreateGroup();
        onGroupCreated(created);
        activeGuid = created.getGuid();
      }

      const textMsg = new CometChat.TextMessage(
        activeGuid,
        message.trim(),
        CometChat.RECEIVER_TYPE.GROUP,
      );
      const sent = await CometChat.sendMessage(textMsg);
      setMessages((prev) => [...prev, sent]);
      setMessage("");
    } catch (err) {
      console.error("Send issue message error:", err);
    } finally {
      setSending(false);
    }
  };

  if (loading) return <ChatSpinner size="sm" />;

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5">
        {sending && !guid ? (
          <div className="flex flex-col items-center justify-center gap-2 py-6 text-xs text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Creating chat and adding users…
          </div>
        ) : (
          messages.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4 italic">
              No messages yet. Start the conversation.
            </p>
          )
        )}
        {messages.map((msg, i) => (
          <MessageBubble key={msg.getId?.() ?? i} msg={msg} index={i} user={user} compact />
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="px-3 py-2 border-t border-border">
        <div className="flex items-center gap-1.5 bg-secondary/50 border border-border rounded-lg px-2.5 py-1.5">
          <input
            aria-label="Type a message"
            className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type a message…"
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
          />
          <button
            onClick={sendMessage}
            disabled={!message.trim() || sending}
            aria-label="Send message"
            className="w-6 h-6 flex items-center justify-center rounded-md bg-accent text-accent-foreground disabled:opacity-40 hover:opacity-90 transition-opacity flex-shrink-0"
          >
            <Send className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
