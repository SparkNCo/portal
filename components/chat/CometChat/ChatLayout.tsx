"use client";

import { useEffect, useState } from "react";
import { CometChat } from "@cometchat/chat-sdk-javascript";
import { COMETCHAT_CONSTANTS } from "./constants";
import { supabase } from "@/lib/supabase-client";
import { useUser } from "context/UserContext";
import ChatSideBar from "./ChatSideBar";
import GroupChat from "./GroupChat";
import DirectChat from "./DirectChat";

const SUPPORT_UID = "60ecb62b-05fb-452f-b2fe-bf7bc84765c3";
const AI_AGENT_UID = "e17fda15-1881-4375-a818-21fb97a507ce";

type AssistantType = "support" | "ai";

export type DirectChatEntry = { uid: string; title: string };

export default function ChatLayout() {
  const { profile, loading: profileLoading } = useUser();

  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<CometChat.User | null>(null);
  const [groups, setGroups] = useState<CometChat.Group[]>([]);
  const [directChats, setDirectChats] = useState<DirectChatEntry[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<CometChat.Group | null>(
    null,
  );
  const [selectedDirect, setSelectedDirect] = useState<DirectChatEntry | null>(
    null,
  );
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createTitle, setCreateTitle] = useState("");
  const [assistantType, setAssistantType] = useState<AssistantType>("support");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (
      ready &&
      groups.length === 0 &&
      directChats.length === 0 &&
      profile?.role === "customer"
    ) {
      setShowCreateModal(true);
    }
  }, [ready, groups.length, directChats.length, profile?.role]);

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
        cometUser = await CometChat.login(
          supaUser.id,
          COMETCHAT_CONSTANTS.AUTH_KEY,
        );
      }
      setUser(cometUser);

      const existingGroups = await fetchGroups();
      setGroups(existingGroups);

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
        `${process.env.NEXT_PUBLIC_ENDPOINT}/assignments?customer=${profile.id}&user_id=${profile.id}`,
        {
          headers: {
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_APIKEY}`,
            apikey: process.env.NEXT_PUBLIC_APIKEY!,
            "Content-Type": "application/json",
          },
        },
      );
      const assignments: any[] = await res.json();

      const guid = `customer_${profile.id}_${Date.now()}`;
      const group = new CometChat.Group(
        guid,
        title,
        CometChat.GROUP_TYPE.PUBLIC,
        "",
      );

      const assignedUids = new Set(
        (assignments ?? [])
          .filter((a) => a.user_id)
          .map((a) => a.user_id as string),
      );
      assignedUids.add(SUPPORT_UID);

      const members = Array.from(assignedUids).map(
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

  const handleCreate = async () => {
    if (!createTitle.trim()) return;
    setCreating(true);
    try {
      if (assistantType === "ai") {
        const entry: DirectChatEntry = {
          uid: AI_AGENT_UID,
          title: createTitle.trim(),
        };
        setDirectChats((prev) => [...prev, entry]);
        setSelectedDirect(entry);
        setSelectedGroup(null);
      } else {
        const created = await createSupportGroup(createTitle.trim());
        if (created) {
          const list = await refreshGroups();
          setSelectedGroup(
            list.find((g) => g.getGuid() === created.getGuid()) ?? created,
          );
          setSelectedDirect(null);
        }
      }
      setShowCreateModal(false);
      setCreateTitle("");
      setAssistantType("support");
    } finally {
      setCreating(false);
    }
  };

  const selectGroup = (group: CometChat.Group) => {
    setSelectedGroup(group);
    setSelectedDirect(null);
  };

  const selectDirect = (entry: DirectChatEntry) => {
    setSelectedDirect(entry);
    setSelectedGroup(null);
  };

  if (profileLoading || !ready) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground text-sm">
        {error ?? "Loading chat..."}
      </div>
    );
  }

  const isCustomer = profile?.role === "customer";
  const hasNoChats = groups.length === 0 && directChats.length === 0;

  return (
    <div className="flex flex-row w-full h-full">
      <ChatSideBar
        groups={groups}
        directChats={directChats}
        selectedGroup={selectedGroup}
        selectedDirect={selectedDirect}
        onSelectGroup={selectGroup}
        onSelectDirect={selectDirect}
        isCustomer={isCustomer}
        onCreateChat={() => setShowCreateModal(true)}
      />

      <div className="flex flex-1 overflow-hidden">
        {selectedGroup && user ? (
          <GroupChat user={user} group={selectedGroup} />
        ) : selectedDirect && user ? (
          <DirectChat
            user={user}
            receiverUID={selectedDirect.uid}
            title={selectedDirect.title}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center text-muted-foreground text-sm">
            {hasNoChats ? "No chats yet." : "Select a chat to start messaging."}
          </div>
        )}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-background border rounded-2xl p-6 w-[360px] shadow-xl space-y-5">
            <div>
              <h2 className="font-semibold text-base">New Chat</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Give your chat a name and choose who to include.
              </p>
            </div>

            <input
              autoFocus
              className="w-full border rounded-lg px-3 py-2.5 text-sm bg-secondary/30 focus:outline-none focus:ring-2 focus:ring-accent/50"
              placeholder="Chat title..."
              value={createTitle}
              onChange={(e) => setCreateTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />

            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Chat type
              </p>
              <div className="flex flex-col gap-2">
                {(["support", "ai"] as const).map((type) => (
                  <label
                    key={type}
                    aria-label={
                      type === "support" ? "Support Developer" : "AI Agent"
                    }
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      assistantType === type
                        ? "border-accent bg-accent/10"
                        : "border-border hover:bg-secondary/40"
                    }`}
                  >
                    <input
                      type="radio"
                      name="assistant"
                      value={type}
                      checked={assistantType === type}
                      onChange={() => setAssistantType(type)}
                      className="accent-black"
                    />
                    <div>
                      <div className="text-sm font-medium">
                        {type === "support" ? "Support Developer" : "AI Agent"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {type === "support"
                          ? "Group chat with your assigned developer"
                          : "Direct conversation with the AI assistant"}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-1">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setCreateTitle("");
                  setAssistantType("support");
                }}
                disabled={creating}
                className="px-4 py-2 text-sm rounded-lg border hover:bg-secondary transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || !createTitle.trim()}
                className="px-4 py-2 text-sm rounded-lg bg-accent text-accent-foreground hover:opacity-90 disabled:opacity-40 transition-opacity font-medium"
              >
                {creating ? "Creating..." : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
