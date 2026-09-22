"use client";

import { useCallback, useEffect, useState } from "react";
import { useUser } from "context/UserContext";
import { API_JSON_HEADERS } from "@/lib/api-headers";

export type Chat = {
  id: string;
  project_slug: string | null;
  title: string | null;
  type: "direct" | "group" | "issue";
  metadata: Record<string, any>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  last_message_at: string | null;
};

const CHATS_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/chats`;

// Replacement for useCometChat.ts's group list/create half (message-level
// concerns live in useRealtimeMessages). Talks to the `chats` edge function
// rather than a direct client .from("chats") query, since chat creation
// needs to resolve portal.assignments server-side the same way
// createSupportGroup() did.
//
// `leaveGroup` has no equivalent yet — there's no DELETE endpoint or RLS
// policy for chat_participants self-removal in this first pass.
export function useRealtimeChat(customerId?: string | null) {
  const { profile, loading: profileLoading } = useUser();
  const [chats, setChats] = useState<Chat[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchChats = useCallback(async (): Promise<Chat[]> => {
    if (!profile?.id) return [];
    const params = new URLSearchParams({ user_id: profile.id });
    if (profile.role === "admin") params.set("admin", "true");
    if (customerId) params.set("customer_id", customerId);

    const res = await fetch(`${CHATS_URL}?${params.toString()}`, {
      headers: API_JSON_HEADERS,
    });
    if (!res.ok) throw new Error("Failed to fetch chats");
    return res.json();
  }, [profile?.id, profile?.role, customerId]);

  useEffect(() => {
    if (profileLoading) return;
    if (!profile?.id) {
      setReady(true);
      return;
    }
    fetchChats()
      .then((data) => {
        setChats(data);
        setReady(true);
      })
      .catch((err) => {
        console.error("Chat init error:", err);
        setError("Failed to initialize chat");
        setReady(true);
      });
  }, [profileLoading, profile?.id, fetchChats]);

  const refreshChats = useCallback(async (): Promise<Chat[]> => {
    try {
      const data = await fetchChats();
      setChats(data);
      return data;
    } catch (err) {
      console.error("Refresh chats error:", err);
      return [];
    }
  }, [fetchChats]);

  const createChat = useCallback(
    async (title: string, groupCustomerId?: string, projectSlug?: string): Promise<Chat | null> => {
      if (!profile) return null;
      try {
        const res = await fetch(CHATS_URL, {
          method: "POST",
          headers: API_JSON_HEADERS,
          body: JSON.stringify({
            type: "group",
            title,
            project_slug: projectSlug,
            customer_id: groupCustomerId,
            profile: { id: profile.id, role: profile.role },
          }),
        });
        if (!res.ok) throw new Error("Failed to create chat");
        const chat: Chat = await res.json();
        await refreshChats();
        return chat;
      } catch (err) {
        console.error("Create chat error:", err);
        return null;
      }
    },
    [profile, refreshChats],
  );

  return {
    chats,
    ready,
    error,
    profileLoading,
    refreshChats,
    createChat,
  };
}
