"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useUser } from "context/UserContext";
import { ChevronLeft } from "lucide-react";
import ChatSideBar from "./ChatSideBar";
import GroupChat from "./GroupChat";
import DirectChat from "./DirectChat";
import CreateChatModal from "./CreateChatModal";
import { useCometChat } from "./useCometChat";

type Group = ReturnType<typeof useCometChat>["groups"][number];


export type DirectChatEntry = { uid: string; title: string };

export default function ChatLayout({ initialTitle }: { readonly initialTitle?: string }) {
  const { profile } = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const { user, groups, ready, error, profileLoading, refreshGroups, createSupportGroup } =
    useCometChat();

  const clearNewChatParam = () => router.replace(pathname);

  const [directChats, setDirectChats] = useState<DirectChatEntry[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [selectedDirect, setSelectedDirect] = useState<DirectChatEntry | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!ready) return;
    if (initialTitle) {
      setShowCreateModal(true);
    }
  }, [ready]);

  const projectSlug = pathname.split("/")[1] ?? undefined;

  const handleCreate = async (title: string) => {
    setCreating(true);
    try {
      const created = await createSupportGroup(title, projectSlug);
      if (created) {
        const list = await refreshGroups();
        setSelectedGroup(list.find((g) => g.getGuid() === created.getGuid()) ?? created);
        setSelectedDirect(null);
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

  const hasActiveChat = selectedGroup !== null || selectedDirect !== null;

  return (
    <div className="flex flex-row w-full h-full">
      {/* Sidebar: full-width on mobile when no chat active, fixed 288px on sm+ */}
      <div className={`flex-shrink-0 sm:w-72 h-full ${hasActiveChat ? "hidden sm:block" : "w-full"}`}>
        <ChatSideBar
          groups={groups}
          directChats={directChats}
          selectedGroup={selectedGroup}
          selectedDirect={selectedDirect}
          onSelectGroup={(g) => { setSelectedGroup(g); setSelectedDirect(null); clearNewChatParam(); }}
          onSelectDirect={(e) => { setSelectedDirect(e); setSelectedGroup(null); clearNewChatParam(); }}
          onCloseGroup={(g) => { if (selectedGroup?.getGuid() === g.getGuid()) setSelectedGroup(null); }}
          onCloseDirect={(e) => { setDirectChats((prev) => prev.filter((d) => d.uid !== e.uid || d.title !== e.title)); if (selectedDirect?.uid === e.uid && selectedDirect?.title === e.title) setSelectedDirect(null); }}
          isCustomer={isCustomer}
          onCreateChat={() => setShowCreateModal(true)}
        />
      </div>

      {/* Chat area: hidden on mobile when no chat selected */}
      <div className={`flex-col flex-1 overflow-hidden ${hasActiveChat ? "flex" : "hidden sm:flex"}`}>
        {/* Back button — mobile only */}
        {hasActiveChat && (
          <button
            onClick={() => { setSelectedGroup(null); setSelectedDirect(null); }}
            className="sm:hidden flex items-center gap-1.5 px-4 py-2 border-b text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to chats
          </button>
        )}
        <div className="flex flex-1 overflow-hidden">
          {selectedGroup && user && <GroupChat user={user} group={selectedGroup} />}
          {!selectedGroup && selectedDirect && user && (
            <DirectChat user={user} receiverUID={selectedDirect.uid} title={selectedDirect.title} />
          )}
          {!selectedGroup && !selectedDirect && (
            <div className="flex flex-1 items-center justify-center text-muted-foreground text-sm">
              {hasNoChats ? "No chats yet." : "Select a chat to start messaging."}
            </div>
          )}
        </div>
      </div>

      {showCreateModal && (
        <CreateChatModal
          creating={creating}
          initialTitle={initialTitle}
          onCreate={handleCreate}
          onClose={() => setShowCreateModal(false)}
        />
      )}
    </div>
  );
}
