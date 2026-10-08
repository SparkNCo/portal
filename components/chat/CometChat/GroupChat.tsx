"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { CometChat } from "@cometchat/chat-sdk-javascript";
import { Users } from "lucide-react";
import { ChatSpinner } from "./ChatSpinner";
import { MessageBubble } from "./MessageBubble";
import { getMessageDate, mergeMessages, sendGroupMessages } from "./chatUtils";
import { DateDivider, markDayStarts } from "../DateDivider";
import { ChatComposer } from "../ChatComposer";

// Who sent a CometChat message (SDK object or raw payload).
const senderUidOf = (m: any): string | undefined => m?.getSender?.()?.getUid?.() ?? m?.sender?.uid;

type Props = Readonly<{
  user: CometChat.User;
  group: CometChat.Group;
}>;

export default function GroupChat({ user, group }: Props) {
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
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
            setMessages((prev) => mergeMessages(prev, [msg]));
          }
        },
        onMediaMessageReceived: (msg: CometChat.MediaMessage) => {
          if (msg.getReceiverId() === guid) {
            setMessages((prev) => mergeMessages(prev, [msg]));
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

  const sendMessage = async (text: string, files: File[]) => {
    try {
      const sent = await sendGroupMessages(guid, text, files);
      setMessages((prev) => mergeMessages(prev, sent));
    } catch (err) {
      console.error("Send group message error:", err);
      throw err;
    }
  };

  if (loading) return <ChatSpinner label="Loading messages..." />;

  const dayStarts = markDayStarts(messages, getMessageDate);

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b">
        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
          <Users className="w-4 h-4 text-primary" />
        </div>
        <div>
          <div className="smalltext font-semibold">{group.getName()}</div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
            <Users className="w-8 h-8 opacity-30" />
            <p className="text-sm md:smalltext">No messages yet. Say hello!</p>
          </div>
        )}

        {messages.map((msg, i) => (
          <Fragment key={msg.getId?.() ?? i}>
            {dayStarts[i] && <DateDivider date={dayStarts[i]} />}
            <MessageBubble
              msg={msg}
              index={i}
              user={user}
              isLast={i === messages.length - 1}
              continuesGroup={i > 0 && !dayStarts[i] && senderUidOf(messages[i - 1]) === senderUidOf(msg)}
            />
          </Fragment>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t">
        <ChatComposer onSend={sendMessage} />
      </div>
    </div>
  );
}
