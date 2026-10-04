"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { CometChat } from "@cometchat/chat-sdk-javascript";
import { Loader2 } from "lucide-react";
import { ChatSpinner } from "./ChatSpinner";
import { MessageBubble } from "./MessageBubble";
import { getMessageDate, sendGroupMessages } from "./chatUtils";
import { DateDivider, markDayStarts } from "../DateDivider";
import { ChatComposer } from "../ChatComposer";

// Who sent a CometChat message (SDK object or raw payload).
const senderUidOf = (m: any): string | undefined => m?.getSender?.()?.getUid?.() ?? m?.sender?.uid;

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
        onMediaMessageReceived: (msg: CometChat.MediaMessage) => {
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

  const sendMessage = async (text: string, files: File[]) => {
    setSending(true);
    try {
      let activeGuid = guid;
      if (!activeGuid) {
        const created = await onCreateGroup();
        onGroupCreated(created);
        activeGuid = created.getGuid();
      }
      const sent = await sendGroupMessages(activeGuid, text, files);
      setMessages((prev) => [...prev, ...sent]);
    } catch (err) {
      console.error("Send issue message error:", err);
      throw err;
    } finally {
      setSending(false);
    }
  };

  if (loading) return <ChatSpinner size="sm" />;

  const dayStarts = markDayStarts(messages, getMessageDate);

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5">
        {sending && !guid ? (
          <div className="flex flex-col items-center justify-center gap-2 py-6 smalltext text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Creating chat and adding users…
          </div>
        ) : (
          messages.length === 0 && (
            <p className="smalltext text-muted-foreground text-center py-4 italic">
              No messages yet. Start the conversation.
            </p>
          )
        )}
        {messages.map((msg, i) => (
          <Fragment key={msg.getId?.() ?? i}>
            {dayStarts[i] && <DateDivider date={dayStarts[i]} />}
            <MessageBubble
              msg={msg}
              index={i}
              user={user}
              compact
              isLast={i === messages.length - 1}
              continuesGroup={i > 0 && !dayStarts[i] && senderUidOf(messages[i - 1]) === senderUidOf(msg)}
            />
          </Fragment>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="px-3 py-2 border-t border-border">
        <ChatComposer onSend={sendMessage} compact placeholder="Type a message…" />
      </div>
    </div>
  );
}
