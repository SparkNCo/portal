"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase-client";
import { useUser } from "context/UserContext";

export type NotificationEvent = {
  id: string;
  actor_user_id: string | null;
  actor_email: string | null;
  action: string;
  object_type: string;
  object_id: string;
  object_title: string | null;
  issue_code: string | null;
  issue_id: string | null;
  preview: string | null;
  link: string;
  created_at: string;
};

export type Notification = {
  id: string;
  user_id: string;
  event_id: string;
  read: boolean;
  created_at: string;
  event: NotificationEvent;
};

const PAGE_SIZE = 3;

type RawNotificationRow = { id: string; user_id: string; event_id: string; read: boolean; created_at: string };

async function fetchEvent(eventId: string): Promise<NotificationEvent | null> {
  const { data, error } = await supabase.schema("portal").from("events").select("*").eq("id", eventId).maybeSingle();
  if (error) {
    console.error("Fetch event error:", error);
    return null;
  }
  return data as NotificationEvent | null;
}

// Read notifications are kept (read = true), never deleted, so they can be
// listed again — capped since, unlike unread ones, they only ever pile up.
const SEEN_LIMIT = 200;

// The "See all" modal's data source, fetched each time it opens (or switches
// tab) rather than kept live: every unread notification (no PAGE_SIZE cap),
// or with `read`, the SEEN_LIMIT most recent already-read ones.
export async function fetchAllNotifications(read = false): Promise<Notification[]> {
  let request = supabase
    .schema("portal")
    .from("notifications")
    .select("*, event:events(*)")
    .eq("read", read)
    .order("created_at", { ascending: false });
  if (read) request = request.limit(SEEN_LIMIT);
  const { data, error } = await request;
  if (error) {
    console.error("Fetch all notifications error:", error);
    return [];
  }
  return (data ?? []) as Notification[];
}

// chat_id → portal.chats.project_slug, for telling which customer a chat
// notification belongs to — a chat event's own `link` is just the generic
// "/chat" (see notify_chat_message), unlike every other event's
// "/{slug}/…". Direct chats have no project_slug and map to null.
export async function fetchChatProjectSlugs(chatIds: string[]): Promise<Record<string, string | null>> {
  if (chatIds.length === 0) return {};
  const { data, error } = await supabase.schema("portal").from("chats").select("id, project_slug").in("id", chatIds);
  if (error) {
    console.error("Fetch chat project slugs error:", error);
    return {};
  }
  return Object.fromEntries((data ?? []).map((c) => [c.id, c.project_slug ?? null]));
}

// Bell icon data source: portal.notifications joined to portal.events (see
// 20260922120000_split_notifications_into_events.sql — a "thing that
// happened" is its own row in `events`, shared by every recipient's
// `notifications` row instead of each carrying its own copy). Only ever
// holds *unread* ones — clicking a notification (markAsRead) drops it from
// the list immediately rather than leaving it there read.
//
// Postgres Changes payloads only carry the table that actually changed —
// an INSERT/UPDATE on `notifications` doesn't include the joined `events`
// row, so both handlers below do one small follow-up fetch for the event
// once they see event_id.
export function useNotifications() {
  const { profile } = useUser();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  // The real total, independent of PAGE_SIZE — the bell only ever shows the
  // 3 most recent (see the .limit(PAGE_SIZE) below), so `notifications.length`
  // alone can't tell "3 shown" apart from "3 of 52 total". Updated only via
  // the realtime subscription below (never optimistically alongside
  // markAsRead/markAllAsRead), so a self-triggered UPDATE only ever
  // decrements it once instead of racing an optimistic decrement here
  // against the echo of the write that caused it.
  const [totalUnreadCount, setTotalUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.id) {
      setNotifications([]);
      setTotalUnreadCount(0);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    const fetchNotifications = async () => {
      const [listResult, countResult] = await Promise.all([
        supabase
          .schema("portal")
          .from("notifications")
          .select("*, event:events(*)")
          .eq("read", false)
          .order("created_at", { ascending: false })
          .limit(PAGE_SIZE),
        supabase.schema("portal").from("notifications").select("*", { count: "exact", head: true }).eq("read", false),
      ]);

      if (cancelled) return;
      if (listResult.error) {
        console.error("Fetch notifications error:", listResult.error);
      } else {
        setNotifications((listResult.data ?? []) as Notification[]);
      }
      if (countResult.error) {
        console.error("Fetch notification count error:", countResult.error);
      } else {
        setTotalUnreadCount(countResult.count ?? 0);
      }
      setLoading(false);
    };

    fetchNotifications();

    const channel = supabase
      .channel(`notifications-${profile.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "portal", table: "notifications", filter: `user_id=eq.${profile.id}` },
        async (payload) => {
          const row = payload.new as RawNotificationRow;
          setTotalUnreadCount((c) => c + 1);
          const event = await fetchEvent(row.event_id);
          if (!event) return;
          setNotifications((prev) => [{ ...row, event }, ...prev].slice(0, PAGE_SIZE));
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "portal", table: "notifications", filter: `user_id=eq.${profile.id}` },
        async (payload) => {
          const row = payload.new as RawNotificationRow;
          if (row.read) {
            setTotalUnreadCount((c) => Math.max(0, c - 1));
            setNotifications((prev) => prev.filter((n) => n.id !== row.id));
            return;
          }
          // Not a read-toggle — a repeat event on the same thread re-pointed
          // this notification at a newer event_id (see notify_chat_message /
          // notifyProject's upsertNotificationForEvent). Doesn't change the
          // unread count either way.
          const event = await fetchEvent(row.event_id);
          if (!event) return;
          setNotifications((prev) => {
            if (!prev.some((n) => n.id === row.id)) return prev;
            return prev
              .map((n) => (n.id === row.id ? { ...row, event } : n))
              .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          });
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [profile?.id]);

  const markAsRead = async (id: string) => {
    // Drop it from the list immediately — read notifications aren't shown
    // at all, not just visually de-emphasized.
    setNotifications((prev) => prev.filter((n) => n.id !== id));

    const { error } = await supabase.schema("portal").from("notifications").update({ read: true }).eq("id", id);
    if (error) console.error("Mark notification read error:", error);
  };

  // Marks every unread row, not just the PAGE_SIZE loaded into
  // `notifications` — otherwise "Clear all" with 10 unread only cleared the
  // 3 visible ones and left the rest behind the "See all" button.
  const markAllAsRead = async () => {
    if (!profile?.id) return;

    setNotifications([]);

    const { error } = await supabase
      .schema("portal")
      .from("notifications")
      .update({ read: true })
      .eq("user_id", profile.id)
      .eq("read", false);
    if (error) console.error("Mark all notifications read error:", error);
  };

  return { notifications, totalUnreadCount, loading, markAsRead, markAllAsRead };
}
