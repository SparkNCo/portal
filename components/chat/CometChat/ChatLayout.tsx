"use client";

import { useEffect, useState } from "react";
import { useUser } from "context/UserContext";
import ChatSideBar from "./ChatSideBar";
import GroupChat from "./GroupChat";
import DirectChat from "./DirectChat";
import CreateChatModal from "./CreateChatModal";
import { useCometChat } from "./useCometChat";

type Group = ReturnType<typeof useCometChat>["groups"][number];

const AI_AGENT_UID = "e17fda15-1881-4375-a818-21fb97a507ce";

export type DirectChatEntry = { uid: string; title: string };

export default function ChatLayout() {
  const { profile } = useUser();
  const { user, groups, ready, error, profileLoading, refreshGroups, createSupportGroup } =
    useCometChat();

  const [directChats, setDirectChats] = useState<DirectChatEntry[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [selectedDirect, setSelectedDirect] = useState<DirectChatEntry | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (ready && groups.length === 0 && directChats.length === 0 && profile?.role === "customer") {
      setShowCreateModal(true);
    }
  }, [ready, groups.length, directChats.length, profile?.role]);

  const handleCreate = async (title: string, type: "support" | "ai") => {
    setCreating(true);
    try {
      if (type === "ai") {
        const entry: DirectChatEntry = { uid: AI_AGENT_UID, title };
        setDirectChats((prev) => [...prev, entry]);
        setSelectedDirect(entry);
        setSelectedGroup(null);
      } else {
        const created = await createSupportGroup(title);
        if (created) {
          const list = await refreshGroups();
          setSelectedGroup(list.find((g) => g.getGuid() === created.getGuid()) ?? created);
          setSelectedDirect(null);
        }
      }
      setShowCreateModal(false);
    } finally {
      setCreating(false);
    }
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
        onSelectGroup={(g) => { setSelectedGroup(g); setSelectedDirect(null); }}
        onSelectDirect={(e) => { setSelectedDirect(e); setSelectedGroup(null); }}
        isCustomer={isCustomer}
        onCreateChat={() => setShowCreateModal(true)}
      />

      <div className="flex flex-1 overflow-hidden">
        {selectedGroup && user ? (
          <GroupChat user={user} group={selectedGroup} />
        ) : selectedDirect && user ? (
          <DirectChat user={user} receiverUID={selectedDirect.uid} title={selectedDirect.title} />
        ) : (
          <div className="flex flex-1 items-center justify-center text-muted-foreground text-sm">
            {hasNoChats ? "No chats yet." : "Select a chat to start messaging."}
          </div>
        )}
      </div>

      {showCreateModal && (
        <CreateChatModal
          creating={creating}
          onCreate={handleCreate}
          onClose={() => setShowCreateModal(false)}
        />
      )}
    </div>
  );
}
