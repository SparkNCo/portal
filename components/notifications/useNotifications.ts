"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase-client";
import { useUser } from "context/UserContext";

export type Notification = {
  id: string;
  user_id: string;
  actor_user_id: string | null;
  actor_email: string | null;
  action: string;
  object_type: string;
  object_id: string;
  preview: string | null;
  issue_code: string | null;
  issue_id: string | null;
  link: string;
  read_at: string | null;
  created_at: string;
};

const PAGE_SIZE = 30;

// Bell icon data source: portal.notifications, RLS-scoped to the caller's
// own rows (see 20260921150000_create_notifications.sql). Only ever holds
// *unread* ones — clicking a notification (markAsRead) drops it from the
// list immediately rather than leaving it there in a "read" state, so
// there's nothing to fetch beyond read_at IS NULL. A Postgres Changes
// subscription prepends anything inserted after the initial load — same
// shape as components/chat/Realtime/useRealtimeMessages.ts.
//
// Also listens for UPDATE: repeat events on the same chat/issue refresh the
// existing unread row in place instead of inserting a new one (see
// 20260921180000_dedupe_unread_notifications.sql and notifyProject's
// upsertUnreadNotification), so a plain INSERT-only subscription would miss
// them. An UPDATE also fires when read_at gets set from another tab/device —
// that's handled the same way as a local markAsRead, by dropping the row.
export function useNotifications() {
  const { profile } = useUser();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.id) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    const fetchNotifications = async () => {
      const { data, error } = await supabase
        .schema("portal")
        .from("notifications")
        .select("*")
        .is("read_at", null)
        .order("created_at", { ascending: false })
        .limit(PAGE_SIZE);

      if (cancelled) return;
      if (error) {
        console.error("Fetch notifications error:", error);
      } else {
        setNotifications((data ?? []) as Notification[]);
      }
      setLoading(false);
    };

    fetchNotifications();

    const channel = supabase
      .channel(`notifications-${profile.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "portal", table: "notifications", filter: `user_id=eq.${profile.id}` },
        (payload) => {
          setNotifications((prev) => [payload.new as Notification, ...prev].slice(0, PAGE_SIZE));
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "portal", table: "notifications", filter: `user_id=eq.${profile.id}` },
        (payload) => {
          const updated = payload.new as Notification;
          setNotifications((prev) => {
            if (updated.read_at) return prev.filter((n) => n.id !== updated.id);
            if (!prev.some((n) => n.id === updated.id)) return prev;
            return prev
              .map((n) => (n.id === updated.id ? updated : n))
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

  const unreadCount = notifications.length;

  const markAsRead = async (id: string) => {
    // Drop it from the list immediately — read notifications aren't shown
    // at all, not just visually de-emphasized.
    setNotifications((prev) => prev.filter((n) => n.id !== id));

    const { error } = await supabase
      .schema("portal")
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id);
    if (error) console.error("Mark notification read error:", error);
  };

  const markAllAsRead = async () => {
    const ids = notifications.map((n) => n.id);
    if (ids.length === 0) return;

    setNotifications([]);

    const { error } = await supabase
      .schema("portal")
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .in("id", ids);
    if (error) console.error("Mark all notifications read error:", error);
  };

  return { notifications, unreadCount, loading, markAsRead, markAllAsRead };
}
