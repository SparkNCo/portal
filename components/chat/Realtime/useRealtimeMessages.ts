"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase-client";
import { useUser } from "context/UserContext";

export type ChatMessage = {
  id: string;
  chat_id: string;
  user_id: string | null;
  body: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

const PAGE_SIZE = 50;

// Replaces the fetch-history + addMessageListener + sendMessage trio that
// GroupChat.tsx/DirectChat.tsx/ConversationChat.tsx each duplicated for
// CometChat. One hook per open chat: loads the last PAGE_SIZE messages,
// then a Postgres Changes subscription appends anything inserted after
// that — including the caller's own message, so there's no separate
// optimistic-append branch to keep in sync with the realtime one.
//
// NOTE: reads/writes portal.messages via PostgREST (supabase-js `.from`),
// which requires the `portal` schema to be listed under Settings > API >
// Exposed schemas in the Supabase dashboard — a project setting, not
// something a migration can turn on. Without it every call here fails with
// "the schema must be one of the following: public...".
export function useRealtimeMessages(chatId: string | null | undefined) {
  const { profile } = useUser();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seenIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!chatId) {
      setMessages([]);
      seenIds.current = new Set();
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const fetchHistory = async () => {
      const { data, error: fetchError } = await supabase
        .schema("portal")
        .from("messages")
        .select("*")
        .eq("chat_id", chatId)
        .order("created_at", { ascending: true })
        .limit(PAGE_SIZE);

      if (cancelled) return;
      if (fetchError) {
        console.error("Fetch messages error:", fetchError);
        setError("Failed to load messages");
      } else {
        seenIds.current = new Set((data ?? []).map((m) => m.id));
        setMessages((data ?? []) as ChatMessage[]);
      }
      setLoading(false);
    };

    fetchHistory();

    const channel = supabase
      .channel(`messages-${chatId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "portal", table: "messages", filter: `chat_id=eq.${chatId}` },
        (payload) => {
          const row = payload.new as ChatMessage;
          if (seenIds.current.has(row.id)) return;
          seenIds.current.add(row.id);
          setMessages((prev) => [...prev, row]);
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [chatId]);

  const sendMessage = async (body: string) => {
    const trimmed = body.trim();
    if (!chatId || !profile?.id || !trimmed || sending) return;

    setSending(true);
    try {
      const { error: sendError } = await supabase
        .schema("portal")
        .from("messages")
        .insert({ chat_id: chatId, user_id: profile.id, body: trimmed });
      if (sendError) throw sendError;
    } catch (err) {
      console.error("Send message error:", err);
      setError("Failed to send message");
    } finally {
      setSending(false);
    }
  };

  return { messages, loading, sending, error, sendMessage };
}
