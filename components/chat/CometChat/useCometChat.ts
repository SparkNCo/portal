import { useEffect, useState } from "react";
import { CometChat } from "@cometchat/chat-sdk-javascript";
import { COMETCHAT_CONSTANTS } from "./constants";
import { useUser } from "context/UserContext";
import { API_JSON_HEADERS } from "@/lib/api-headers";
import { initCometChatUser } from "./initCometChatUser";

// `customerId` scopes the group list to a single customer's support chats —
// used when an admin/developer opens a specific customer's chat panel via
// the Dashboards flow (see ChatLayout). It's the customer's portal user id
// (not the display slug), since `clientName` shows up formatted differently
// depending on which flow produced it (raw vs slugified at onboarding),
// which made slug-based matching unreliable — a chat created right after
// onboarding (slugified) would never match one viewed in a later normal
// session (raw). Left undefined, this fetches the caller's normal
// (unscoped) inbox, same as before.
const MAX_GROUP_PAGES = 20;

// CometChat makes whoever calls `createGroupWithMembers` the group's owner,
// and an owner can't leave a group without transferring ownership first
// (`ERR_OWNER_EXIT_FORBIDDEN`). Support chats are meant to be leaveable by
// the customer/stakeholder who started them, so ownership is handed off to
// a fixed staff account right after creation — same account already used
// elsewhere for staff-authored messages (see StaffChatInput.tsx/Chat.tsx).
const SUPPORT_OWNER_UID = process.env.NEXT_PUBLIC_COMET_ADMIN_UID as string | undefined;

export function useCometChat(customerId?: string | null) {
  const { profile, loading: profileLoading } = useUser();
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<CometChat.User | null>(null);
  const [groups, setGroups] = useState<CometChat.Group[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (profileLoading) return;
    globalThis.window.CometChat =
      require("@cometchat/chat-sdk-javascript").CometChat;
    init();
  }, [profileLoading]);

  // Re-filter (without re-running the full CometChat login) when the admin
  // switches which customer's chat panel they're looking at.
  useEffect(() => {
    if (!ready) return;
    fetchGroups().then(setGroups);
  }, [customerId, ready]);

  const init = async () => {
    try {
      const cometUser = await initCometChatUser();
      setUser(cometUser);
      setGroups(await fetchGroups());
      setReady(true);
    } catch (err) {
      console.error("Chat init error:", err);
      setError("Failed to initialize chat");
    }
  };

  const fetchGroups = async (): Promise<CometChat.Group[]> => {
    const isAdmin = profile?.role === "admin";
    const builder = new CometChat.GroupsRequestBuilder().setLimit(50);
    if (!isAdmin) builder.joinedOnly(true);
    const request = builder.build();

    // A single `fetchNext()` only returns the first page — loop until the
    // SDK reports no more results (bounded, so a misbehaving request can't
    // spin forever) instead of silently missing a customer's group past
    // the first 50 results.
    const all: CometChat.Group[] = [];
    for (let page = 0; page < MAX_GROUP_PAGES; page++) {
      const batch = await request.fetchNext();
      if (!batch.length) break;
      all.push(...batch);
      if (batch.length < 50) break;
    }

    if (!customerId) return all;
    return all.filter(
      (g) => (g.getMetadata() as { customerId?: string } | undefined)?.customerId === customerId,
    );
  };

  const refreshGroups = async () => {
    const list = await fetchGroups();
    setGroups(list);
    return list;
  };

  // Actually leaves the group in CometChat (removes the caller as a member)
  // rather than just hiding it locally — the group itself and its history
  // are untouched, so admins (who list all public groups regardless of
  // membership) still see it.
  const leaveGroup = async (guid: string): Promise<boolean> => {
    try {
      await CometChat.leaveGroup(guid);
      setGroups((prev) => prev.filter((g) => g.getGuid() !== guid));
      return true;
    } catch (err) {
      console.error("Leave group error:", err);
      return false;
    }
  };

  const createSupportGroup = async (
    title: string,
    groupCustomerId?: string,
    projectSlug?: string,
  ): Promise<CometChat.Group | null> => {
    if (!profile) return null;
    try {
      const memberUids = new Set<string>();
      memberUids.add(profile.id);
      if (SUPPORT_OWNER_UID) memberUids.add(SUPPORT_OWNER_UID);
      let assignees: any[] = [];
      // The customer this group belongs to, for tagging — resolved from the
      // creator's own identity when they're a customer/stakeholder, since
      // that's more reliable than a value threaded in from the caller.
      let resolvedCustomerId: string | undefined =
        profile.role === "customer" ? profile.id : groupCustomerId;

      if (profile.role === "stakeholder") {
        // Step 1: find the customer this stakeholder is assigned to
        const stakeholderRes = await fetch(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/assignments?developer=${profile.id}`,
          { headers: API_JSON_HEADERS },
        );
        const stakeholderAssignments: any[] = await stakeholderRes.json();
        const customerIds = stakeholderAssignments
          .map((a) => a.customer_id)
          .filter(Boolean);

        if (customerIds.length > 0) {
          resolvedCustomerId = customerIds[0];
          // Add the customer(s)
          customerIds.forEach((id: string) => memberUids.add(id));

          // Step 2: fetch developers assigned to that customer
          const devRes = await fetch(
            `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/assignments?customer_id=${customerIds[0]}&onlyDev=true`,
            { headers: API_JSON_HEADERS },
          );
          assignees = await devRes.json();
          (assignees ?? [])
            .filter((a) => a.user_id)
            .forEach((a) => memberUids.add(a.user_id));
        }
      } else {
        // Customer: fetch all assignees (developers + stakeholders)
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/assignments?customer_id=${profile.id}`,
          { headers: API_JSON_HEADERS },
        );
        assignees = await res.json();
        (assignees ?? [])
          .filter((a) => a.user_id)
          .forEach((a) => memberUids.add(a.user_id));
      }

      await Promise.all(
        Array.from(memberUids).map(async (uid) => {
          try {
            await CometChat.getUser(uid);
          } catch (e: any) {
            if (e?.code === "ERR_UID_NOT_FOUND") {
              const assignee = (assignees ?? []).find((a) => a.user_id === uid);
              const newUser = new CometChat.User(uid);
              newUser.setName(assignee?.email ?? uid);
              await CometChat.createUser(newUser, COMETCHAT_CONSTANTS.AUTH_KEY);
            }
          }
        }),
      );

      const guid = `customer_${profile.id}_${Date.now()}`;
      const group = new CometChat.Group(
        guid,
        title,
        CometChat.GROUP_TYPE.PUBLIC,
        "",
      );
      if (resolvedCustomerId || projectSlug) {
        group.setMetadata({ customerId: resolvedCustomerId, projectSlug });
      }
      const members = Array.from(memberUids).map(
        (uid) =>
          new CometChat.GroupMember(
            uid,
            CometChat.GROUP_MEMBER_SCOPE.PARTICIPANT,
          ),
      );

      const response = await CometChat.createGroupWithMembers(
        group,
        members,
        [],
      );

      // Hand ownership to the fixed staff account so the creator (if not
      // already that account) can leave later without hitting
      // ERR_OWNER_EXIT_FORBIDDEN.
      if (SUPPORT_OWNER_UID && profile.id !== SUPPORT_OWNER_UID) {
        try {
          await CometChat.transferGroupOwnership(guid, SUPPORT_OWNER_UID);
        } catch (transferErr) {
          console.error("Failed to transfer group ownership:", transferErr);
        }
      }

      return (response as any).group ?? null;
    } catch (err) {
      console.error("Create group error:", err);
      return null;
    }
  };

  return {
    user,
    groups,
    ready,
    error,
    profileLoading,
    refreshGroups,
    createSupportGroup,
    leaveGroup,
  };
}
