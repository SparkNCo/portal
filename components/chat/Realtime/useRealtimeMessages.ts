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
  // `sending` (React state) updates asynchronously, so a second send fired
  // in the same tick as the first — e.g. Enter key-repeat, or a stray extra
  // click before the re-render lands — could still read the stale `false`
  // and slip past the `sending` check below. A ref updates immediately.
  const sendingRef = useRef(false);

  useEffect(() => {
    if (!chatId) {
      setMessages([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    // Dedupe against the *current* state (functional update) rather than a
    // separate seenIds ref kept in sync by hand — the initial history fetch
    // below and the realtime subscription both run concurrently, so the
    // sender's own message can be appended by the subscription before the
    // fetch (dispatched first) resolves. A ref-tracked "seen" set can fall
    // out of sync with that race; checking the real array can't.
    const addMessage = (row: ChatMessage) => {
      setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]));
    };

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
        // Merge instead of overwrite — replacing outright would either drop
        // a message the realtime subscription already appended (if this
        // fetch's own snapshot predates it) or, combined with that append,
        // show it twice once both updates landed.
        setMessages((prev) => {
          const byId = new Map(prev.map((m) => [m.id, m]));
          for (const row of (data ?? []) as ChatMessage[]) byId.set(row.id, row);
          return Array.from(byId.values()).sort(
            (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
          );
        });
      }
      setLoading(false);
    };

    fetchHistory();

    const channel = supabase
      .channel(`messages-${chatId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "portal", table: "messages", filter: `chat_id=eq.${chatId}` },
        (payload) => addMessage(payload.new as ChatMessage),
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [chatId]);

  const sendMessage = async (body: string) => {
    const trimmed = body.trim();
    if (!chatId || !profile?.id || !trimmed || sendingRef.current) return;

    sendingRef.current = true;
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
      sendingRef.current = false;
      setSending(false);
    }
  };

  return { messages, loading, sending, error, sendMessage };
}
