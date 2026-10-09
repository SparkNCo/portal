"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { useUser } from "context/UserContext";
import { API_JSON_HEADERS } from "@/lib/api-headers";
import { ChatSpinner } from "../CometChat/ChatSpinner";
import { RealtimeMessageBubble } from "./RealtimeMessageBubble";
import { DateDivider, markDayStarts } from "../DateDivider";
import { postRealtimeMessage, useRealtimeMessages } from "./useRealtimeMessages";
import { ChatComposer } from "../ChatComposer";
import type { Chat } from "./useRealtimeChat";

const CHATS_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/chats`;

// Realtime equivalent of CometChat/IssueCometChat.tsx + IssueGroupChat.tsx.
// Same lazy-create shape: opening the tab only *looks up* whether this
// issue already has a chat (GET /chats?issueId=) — it doesn't create one
// (and seed every assignee as a participant) just from being viewed. Only
// sending the first message does that.
export function IssueRealtimeChat({
  issueId,
  issueTitle,
  slug,
}: {
  readonly issueId: string;
  readonly issueTitle: string;
  // Which customer this issue belongs to — needed server-side to resolve
  // participants when the caller is a developer/admin (see
  // getOrCreateIssueChat.ts), same as CometChat's own `slug` prop.
  readonly slug?: string;
}) {
  const { profile, loading: profileLoading } = useUser();
  const [chat, setChat] = useState<Chat | null>(null);
  const [loadingChat, setLoadingChat] = useState(true);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { messages, loading: loadingMessages, sendMessage } = useRealtimeMessages(chat?.id);

  useEffect(() => {
    if (profileLoading) return;
    let cancelled = false;
    setLoadingChat(true);
    setLookupError(null);

    (async () => {
      try {
        const res = await fetch(`${CHATS_URL}?issueId=${issueId}`, { headers: API_JSON_HEADERS });
        if (!res.ok) throw new Error("Failed to load chat");
        const data = await res.json();
        if (!cancelled) setChat(data ?? null);
      } catch (err) {
        console.error("Issue chat lookup error:", err);
        if (!cancelled) setLookupError("Failed to load chat");
      } finally {
        if (!cancelled) setLoadingChat(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [profileLoading, issueId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Throws on failure so the composer keeps the draft and files.
  const handleSend = async (text: string, files: File[]) => {
    if (creating || !profile) return;

    if (chat) {
      // Chat already exists — the hook's own sendMessage handles it.
      await sendMessage(text, files);
      return;
    }

    // First message on this issue — create the chat (and seed
    // participants) then send directly. useRealtimeMessages(chat?.id)
    // won't pick up the new id until the next render, so its sendMessage
    // would still see chat?.id as undefined if called right after
    // setChat() here — inserting directly avoids that one-render lag.
    setCreating(true);
    try {
      const res = await fetch(`${CHATS_URL}?type=issue`, {
        method: "POST",
        headers: API_JSON_HEADERS,
        body: JSON.stringify({
          issueId,
          issueTitle,
          slug,
          profile: { id: profile.id, role: profile.role },
        }),
      });
      if (!res.ok) throw new Error("Failed to create chat");
      const created: Chat = await res.json();
      setChat(created);

      await postRealtimeMessage(created.id, profile.id, text, files);
    } catch (err) {
      console.error("Create issue chat error:", err);
      throw err;
    } finally {
      setCreating(false);
    }
  };

  if (loadingChat) return <ChatSpinner size="sm" label="Loading chat…" />;
  if (lookupError) return <p className="text-xs text-destructive text-center py-4">{lookupError}</p>;
  if (!profile) return null;

  const showLoadingMessages = !!chat && loadingMessages;

  const dayStarts = markDayStarts(messages, (msg) => new Date(msg.created_at));

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5">
        {showLoadingMessages ? (
          <ChatSpinner size="sm" />
        ) : creating && !chat ? (
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
        {!showLoadingMessages &&
          messages.map((msg, i) => (
            <Fragment key={msg.id}>
              {dayStarts[i] && <DateDivider date={dayStarts[i]} />}
              <RealtimeMessageBubble
                msg={msg}
                currentUserId={profile.id}
                senderName={msg.user_id === profile.id ? "You" : "Team"}
                compact
                isLast={i === messages.length - 1}
                continuesGroup={i > 0 && !dayStarts[i] && messages[i - 1]?.user_id === msg.user_id}
              />
            </Fragment>
          ))}
        <div ref={bottomRef} />
      </div>

      <div className="px-3 py-2 border-t border-border">
        <ChatComposer onSend={handleSend} disabled={creating} compact placeholder="Type a message…" />
      </div>
    </div>
  );
}
