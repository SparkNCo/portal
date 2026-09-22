"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useUser } from "context/UserContext";
import { supabase } from "@/lib/supabase-client";
import { API_JSON_HEADERS } from "@/lib/api-headers";
import { ChatSpinner } from "../CometChat/ChatSpinner";
import { RealtimeMessageBubble } from "./RealtimeMessageBubble";
import { useRealtimeMessages } from "./useRealtimeMessages";
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
  const [draft, setDraft] = useState("");
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

  const handleSend = async () => {
    const trimmed = draft.trim();
    if (!trimmed || creating || !profile) return;

    if (chat) {
      // Chat already exists — the hook's own sendMessage handles it.
      setDraft("");
      await sendMessage(trimmed);
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

      const { error } = await supabase
        .schema("portal")
        .from("messages")
        .insert({ chat_id: created.id, user_id: profile.id, body: trimmed });
      if (error) throw error;
      setDraft("");
    } catch (err) {
      console.error("Create issue chat error:", err);
    } finally {
      setCreating(false);
    }
  };

  if (loadingChat) return <ChatSpinner size="sm" label="Loading chat…" />;
  if (lookupError) return <p className="text-xs text-destructive text-center py-4">{lookupError}</p>;
  if (!profile) return null;

  const showLoadingMessages = !!chat && loadingMessages;

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
          messages.map((msg) => (
            <RealtimeMessageBubble
              key={msg.id}
              msg={msg}
              currentUserId={profile.id}
              senderName={msg.user_id === profile.id ? "You" : "Team"}
              compact
            />
          ))}
        <div ref={bottomRef} />
      </div>

      <div className="px-3 py-2 border-t border-border">
        <div className="flex items-center gap-1.5 bg-card/90 border border-border rounded-lg px-2.5 py-1.5">
          <div className="min-w-0 flex-1">
            <Input
              aria-label="Type a message"
              className="h-auto border-0 bg-transparent px-0 py-0 shadow-none focus-visible:ring-0 smalltext text-card-foreground placeholder:text-card-foreground/40"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Type a message…"
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            />
          </div>
          <button
            onClick={handleSend}
            disabled={!draft.trim() || creating}
            aria-label="Send message"
            className="w-6 h-6 flex items-center justify-center rounded-md bg-primary text-primary-foreground disabled:opacity-40 hover:opacity-90 transition-opacity flex-shrink-0"
          >
            <Send className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
