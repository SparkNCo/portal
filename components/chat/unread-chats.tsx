"use client";

import { createContext, useCallback, useContext, useEffect, useId, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase-client";
import { useUser } from "context/UserContext";

// Which chats have messages the user hasn't seen.
//
// There's no separate "last read" bookkeeping: every chat message already
// leaves each recipient one unread bell notification per chat (object_type
// "chat", object_id = the chat's id — a portal.chats id for Realtime, the
// group's guid for CometChat; see notify_chat_message and the cometchat
// webhook). So a chat is unread while that notification is, and opening the
// chat marks it read — which also clears it from the bell.

type ChatNotification = { id: string; chatId: string };

async function fetchUnreadChatNotifications(): Promise<ChatNotification[]> {
  const { data, error } = await supabase
    .schema("portal")
    .from("notifications")
    .select("id, event:events!inner(object_type, object_id)")
    .eq("read", false)
    .eq("event.object_type", "chat");
  if (error) {
    console.error("Fetch unread chats error:", error);
    return [];
  }
  return (data ?? []).map((n: any) => ({ id: n.id, chatId: n.event.object_id }));
}

// Marks a chat's notification(s) read for the signed-in user. Safe to call
// when there's nothing unread.
export async function markChatRead(chatId: string): Promise<void> {
  const unread = (await fetchUnreadChatNotifications()).filter((n) => n.chatId === chatId);
  if (unread.length === 0) return;
  const { error } = await supabase
    .schema("portal")
    .from("notifications")
    .update({ read: true })
    .in("id", unread.map((n) => n.id));
  if (error) console.error("Mark chat read error:", error);
}

// Live set of unread chat ids, plus a way to mark one read. Used by the chat
// pages (which hand it to their sidebar) and by a ticket's chat tab.
export function useUnreadChats() {
  const { profile } = useUser();
  // Two of these can be mounted at once (a chat page and a ticket modal) —
  // each needs its own realtime channel name.
  const instanceId = useId();
  const [unread, setUnread] = useState<ChatNotification[]>([]);

  useEffect(() => {
    if (!profile?.id) {
      setUnread([]);
      return;
    }
    let cancelled = false;
    const refresh = async () => {
      const rows = await fetchUnreadChatNotifications();
      if (!cancelled) setUnread(rows);
    };
    refresh();

    // Any change to this user's notifications (a new message, one re-pointed
    // at a newer message, one read here or from the bell) → re-read the set.
    const channel = supabase
      .channel(`unread-chats-${profile.id}-${instanceId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "portal", table: "notifications", filter: `user_id=eq.${profile.id}` },
        refresh,
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [profile?.id, instanceId]);

  const unreadChatIds = useMemo(() => new Set(unread.map((n) => n.chatId)), [unread]);

  const markRead = useCallback(async (chatId: string) => {
    // Drop it right away; the subscription confirms it.
    setUnread((prev) => prev.filter((n) => n.chatId !== chatId));
    await markChatRead(chatId);
  }, []);

  return { unreadChatIds, markRead };
}

const UnreadChatsContext = createContext<ReadonlySet<string>>(new Set());

export function UnreadChatsProvider({
  unreadChatIds,
  children,
}: Readonly<{ unreadChatIds: ReadonlySet<string>; children: React.ReactNode }>) {
  return <UnreadChatsContext.Provider value={unreadChatIds}>{children}</UnreadChatsContext.Provider>;
}

export function useIsChatUnread(chatId: string): boolean {
  return useContext(UnreadChatsContext).has(chatId);
}

export function useUnreadChatIds(): ReadonlySet<string> {
  return useContext(UnreadChatsContext);
}

// Marks `chatId` read while it's the one on screen — when it opens, and again
// whenever a message arrives in it (`unread` flips back to true).
export function useMarkOpenChatRead(
  chatId: string | null | undefined,
  unreadChatIds: ReadonlySet<string>,
  markRead: (chatId: string) => void,
) {
  const isUnread = !!chatId && unreadChatIds.has(chatId);
  useEffect(() => {
    if (chatId && isUnread) markRead(chatId);
  }, [chatId, isUnread, markRead]);
}

// The dot next to a chat with unseen messages.
export function UnreadDot() {
  return (
    <span className="ml-auto flex-shrink-0" title="Unread messages">
      <span className="block h-2.5 w-2.5 rounded-full bg-primary" aria-hidden="true" />
      <span className="sr-only">Unread messages</span>
    </span>
  );
}

// "Unread" toggle above the chat list.
export function UnreadFilterToggle({
  active,
  count,
  onToggle,
}: Readonly<{ active: boolean; count: number; onToggle: () => void }>) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs md:smalltext font-medium transition-colors ${
        active
          ? "border-primary bg-primary/15 text-primary"
          : "border-border text-muted-foreground hover:text-foreground hover:bg-secondary/40"
      }`}
    >
      <span className={`h-2 w-2 rounded-full ${count > 0 ? "bg-primary" : "bg-muted-foreground/40"}`} aria-hidden="true" />
      Unread{count > 0 ? ` (${count})` : ""}
    </button>
  );
}
