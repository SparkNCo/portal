import { useEffect, useState } from "react";
import { CometChat } from "@cometchat/chat-sdk-javascript";
import { COMETCHAT_CONSTANTS } from "./constants";
import { supabase } from "@/lib/supabase-client";
import { useUser } from "context/UserContext";

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
      await CometChat.init(
        COMETCHAT_CONSTANTS.APP_ID,
        new CometChat.AppSettingsBuilder()
          .setRegion(COMETCHAT_CONSTANTS.REGION)
          .subscribePresenceForAllUsers()
          .build(),
      );

      const { data } = await supabase.auth.getUser();
      const supaUser = data.user;
      if (!supaUser) throw new Error("Not logged in");

      let cometUser = await CometChat.getLoggedinUser();
      if (cometUser && cometUser.getUid() !== supaUser.id) {
        await CometChat.logout();
        cometUser = null;
      }
      if (!cometUser) {
        try {
          cometUser = await CometChat.login(
            supaUser.id,
            COMETCHAT_CONSTANTS.AUTH_KEY,
          );
        } catch (loginErr: any) {
          if (loginErr?.code !== "ERR_UID_NOT_FOUND") throw loginErr;
          const newUser = new CometChat.User(supaUser.id);
          newUser.setName(supaUser.email ?? supaUser.id);
          await CometChat.createUser(newUser, COMETCHAT_CONSTANTS.AUTH_KEY);
          cometUser = await CometChat.login(
            supaUser.id,
            COMETCHAT_CONSTANTS.AUTH_KEY,
          );
        }
      }
      setUser(cometUser);
      setGroups(await fetchGroups());
      setReady(true);
    } catch (err) {
      console.error("Chat init error:", err);
      setError("Failed to initialize chat");
    }
  };

  const fetchGroups = async (): Promise<CometChat.Group[]> => {
    const req = new CometChat.GroupsRequestBuilder()
      .setLimit(50)
      .joinedOnly(true)
      .build();
    return req.fetchNext();
  };

  const refreshGroups = async () => {
    const list = await fetchGroups();
    setGroups(list);
    return list;
  };

  const createSupportGroup = async (
    title: string,
  ): Promise<CometChat.Group | null> => {
    if (!profile) return null;
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_ENDPOINT}/assignments?customer_id=${profile.id}&onlyDev=true`,
        {
          headers: {
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_APIKEY}`,
            apikey: process.env.NEXT_PUBLIC_APIKEY!,
            "Content-Type": "application/json",
          },
        },
      );
      const assignees: any[] = await res.json();

      const memberUids = new Set<string>(
        (assignees ?? [])
          .filter((a) => a.user_id)
          .map((a) => a.user_id as string),
      );
      memberUids.add(profile.id);

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
