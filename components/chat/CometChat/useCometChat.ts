import { useEffect, useState } from "react";
import { CometChat } from "@cometchat/chat-sdk-javascript";
import { COMETCHAT_CONSTANTS } from "./constants";
import { useUser } from "context/UserContext";
import { API_JSON_HEADERS } from "@/lib/api-headers";
import { initCometChatUser } from "./initCometChatUser";

export function useCometChat() {
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
    return builder.build().fetchNext();
  };

  const refreshGroups = async () => {
    const list = await fetchGroups();
    setGroups(list);
    return list;
  };

  const createSupportGroup = async (
    title: string,
    projectSlug?: string,
  ): Promise<CometChat.Group | null> => {
    if (!profile) return null;
    try {
      const memberUids = new Set<string>();
      memberUids.add(profile.id);
      let assignees: any[] = [];

      if (profile.role === "stakeholder") {
        // Step 1: find the customer this stakeholder is assigned to
        const stakeholderRes = await fetch(
          `${process.env.NEXT_PUBLIC_ENDPOINT}/assignments?developer=${profile.id}`,
          { headers: API_JSON_HEADERS },
        );
        const stakeholderAssignments: any[] = await stakeholderRes.json();
        const customerIds = stakeholderAssignments
          .map((a) => a.customer_id)
          .filter(Boolean);

        if (customerIds.length > 0) {
          // Add the customer(s)
          customerIds.forEach((id: string) => memberUids.add(id));

          // Step 2: fetch developers assigned to that customer
          const devRes = await fetch(
            `${process.env.NEXT_PUBLIC_ENDPOINT}/assignments?customer_id=${customerIds[0]}&onlyDev=true`,
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
          `${process.env.NEXT_PUBLIC_ENDPOINT}/assignments?customer_id=${profile.id}`,
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
      if (projectSlug) group.setMetadata({ projectSlug });
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
  };
}
