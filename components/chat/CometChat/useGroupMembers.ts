"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CometChat } from "@cometchat/chat-sdk-javascript";
import { API_JSON_HEADERS } from "@/lib/api-headers";
import type { MentionOption } from "../mentions";

const AI_UID = process.env.NEXT_PUBLIC_COMET_AI_UID;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type PortalUser = {
  id: string;
  email: string | null;
  userName: string | null;
  firstName: string | null;
  lastName: string | null;
};

function portalName(user: PortalUser): string {
  const full = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  return full || user.userName || user.email || "";
}

// The people in a CometChat group, as { id: uid, name } — who can be
// @mentioned there, and the names behind the "<@uid:…>" tokens in its
// messages. Empty until the group exists (a ticket's chat is only created
// with its first message) or if the lookup fails; mentions are then just off.
//
// Names come from the portal, not CometChat: a CometChat user's "name" is
// often just their email or their uid. A member is matched to a portal user
// by id, or — since some sign into CometChat with their Supabase Auth id
// instead — by the email CometChat has as their name.
export function useGroupMembers(guid: string | undefined): MentionOption[] {
  const [members, setMembers] = useState<MentionOption[]>([]);

  useEffect(() => {
    if (!guid) {
      setMembers([]);
      return;
    }
    let cancelled = false;
    new CometChat.GroupMembersRequestBuilder(guid)
      .setLimit(100)
      .build()
      .fetchNext()
      .then((list) => {
        if (cancelled) return;
        setMembers(
          list
            .map((m) => ({ id: m.getUid(), name: m.getName() }))
            .filter((m) => m.id && m.id !== AI_UID),
        );
      })
      .catch((err) => {
        console.error("Group members lookup error:", err);
        if (!cancelled) setMembers([]);
      });
    return () => {
      cancelled = true;
    };
  }, [guid]);

  // Same list (and cache) the Realtime chat uses for its names.
  const { data: portalUsers } = useQuery({
    queryKey: ["all-users-for-chat-filter"],
    queryFn: async () => {
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/users`, {
        headers: API_JSON_HEADERS,
      });
      if (!res.ok) throw new Error("Failed to fetch users");
      return res.json() as Promise<PortalUser[]>;
    },
    enabled: members.length > 0,
  });

  return useMemo(() => {
    const byId = new Map((portalUsers ?? []).map((u) => [u.id, u]));
    const byEmail = new Map((portalUsers ?? []).filter((u) => u.email).map((u) => [u.email!.toLowerCase(), u]));
    return members
      .map((m) => {
        const user = byId.get(m.id) ?? byEmail.get((m.name ?? "").toLowerCase());
        // `person`: someone can be in a group under two uids (their portal id
        // and their Auth id). Both are kept — a message can come from either —
        // and the mention picker lists the person once (mentionablePeople).
        return { id: m.id, name: (user && portalName(user)) || m.name || "", person: user?.id ?? m.id };
      })
      // No real name (CometChat only has their uid): nothing to show or type.
      .filter((m) => m.name && !UUID_RE.test(m.name))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [members, portalUsers]);
}
