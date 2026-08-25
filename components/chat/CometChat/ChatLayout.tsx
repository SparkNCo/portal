"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useUser } from "context/UserContext";
import { useCustomerSlug } from "context/CustomerSlugContext";
import { usePinnedPanelsOwnerId } from "@/hooks/use-pinned-panels";
import { API_JSON_HEADERS } from "@/lib/api-headers";
import { ChevronLeft } from "lucide-react";
import ChatSideBar from "./ChatSideBar";
import GroupChat from "./GroupChat";
import DirectChat from "./DirectChat";
import CreateChatModal from "./CreateChatModal";
import { useCometChat } from "./useCometChat";

type Group = ReturnType<typeof useCometChat>["groups"][number];


export type DirectChatEntry = { uid: string; title: string };

export default function ChatLayout({
  initialTitle,
  fallbackProjectSlug,
}: {
  readonly initialTitle?: string;
  // The caller's own `[slug]` route segment, if it has one — used to tag
  // brand-new chat groups when no customer is being viewed. Routes with no
  // personal slug (e.g. /admin/chats) simply omit this.
  readonly fallbackProjectSlug?: string;
}) {
  const { profile } = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const customerSlug = useCustomerSlug();
  // usePinnedPanelsOwnerId() always resolves to *some* user id (falling back
  // to the caller's own id when no customer is being viewed) — appropriate
  // for pinned panels, but wrong here: an unscoped inbox (own /chat, not
  // viewing a customer's dashboard) must stay unfiltered, not filtered down
  // to "groups tagged with my own id" (which never matches, since groups
  // are tagged with the customer's id). Only apply an id when a customer is
  // actually being viewed.
  const viewedCustomerId = usePinnedPanelsOwnerId();
  const customerId = customerSlug ? viewedCustomerId : undefined;
  const { user, groups, ready, error, profileLoading, refreshGroups, createSupportGroup, leaveGroup } =
    useCometChat(customerId);

  const isAdmin = profile?.role === "admin";
  // Empty string = no filter (show every customer's chats).
  const [selectedCustomerId, setSelectedCustomerId] = useState("");

  // Admin-only: lets the unscoped inbox be filtered down to one customer at
  // a time (matched against each group's `customerId` metadata) rather than
  // needing to know an email or dig through every project's chats.
  const { data: allUsers } = useQuery({
    queryKey: ["all-users-for-chat-filter"],
    queryFn: async () => {
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/users`, {
        headers: API_JSON_HEADERS,
      });
      if (!res.ok) throw new Error("Failed to fetch users");
      return res.json() as Promise<{ id: string; userName?: string; role: string }[]>;
    },
    enabled: isAdmin,
  });

  const customerOptions = useMemo(() => {
    return (allUsers ?? [])
      .filter((u) => u.role === "customer" && u.userName)
      .map((u) => ({ id: u.id, userName: u.userName! }))
      .sort((a, b) => a.userName.localeCompare(b.userName));
  }, [allUsers]);

  const isDeveloper = profile?.role === "developer";

  // Developer-only: which initiatives they're assigned to, for the "New
  // Chat" initiative picker (admins reuse customerOptions above instead,
  // since they can start a chat for any initiative).
  const { data: developerAssignments } = useQuery({
    queryKey: ["developer-initiatives-for-chat", profile?.id],
    queryFn: async () => {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/assignments?developer=${profile!.id}`,
        { headers: API_JSON_HEADERS },
      );
      if (!res.ok) throw new Error("Failed to fetch assignments");
      return res.json() as Promise<
        { customer_id: string; clientName?: string | null; customer_email?: string | null }[]
      >;
    },
    enabled: isDeveloper && !!profile?.id,
  });

  // Only developers/admins get the "pick an initiative" step in New Chat —
  // customers/stakeholders each have exactly one implicit initiative already.
  const initiativeOptions = useMemo(() => {
    if (isAdmin) {
      return customerOptions.map((c) => ({ id: c.id, label: c.userName }));
    }
    if (isDeveloper) {
      const byId = new Map<string, string>();
      for (const a of developerAssignments ?? []) {
        if (a.customer_id && !byId.has(a.customer_id)) {
          byId.set(a.customer_id, a.clientName ?? a.customer_email ?? a.customer_id);
        }
      }
      return Array.from(byId.entries())
        .map(([id, label]) => ({ id, label }))
        .sort((a, b) => a.label.localeCompare(b.label));
    }
    return [];
  }, [isAdmin, isDeveloper, customerOptions, developerAssignments]);

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

  // When an admin/developer is viewing a specific customer's chat panel,
  // tag new groups with that customer's slug rather than the caller's own
  // `[slug]` segment — which for that flow is the viewer's own slug, not
  // the customer's (see dashboards/[customer]/[panel]/page.tsx).
  const projectSlug = customerSlug ?? fallbackProjectSlug ?? undefined;

  const handleCreate = async (title: string, initiativeId?: string) => {
    setCreating(true);
    try {
      const created = await createSupportGroup(title, initiativeId ?? customerId, projectSlug);
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
      <div className="flex flex-1 items-center justify-center text-muted-foreground text-sm md:smalltext">
        {error ?? "Loading chat..."}
      </div>
    );
  }

  const isCustomer = profile?.role === "customer";
  // Admins shouldn't remove themselves from a group — chats need to stay
  // readable by admins. Customers/developers/stakeholders can actually
  // leave, dropping the chat off their own list (the group and its
  // history are untouched for everyone else, including admins, who list
  // all public groups regardless of membership).
  const canLeaveChats = profile?.role !== "admin";
  const visibleGroups = isAdmin && selectedCustomerId
    ? groups.filter((g) => {
        const groupCustomerId = (g.getMetadata() as { customerId?: string } | undefined)?.customerId;
        return groupCustomerId === selectedCustomerId;
      })
    : groups;
  const hasNoChats = visibleGroups.length === 0 && directChats.length === 0;

  const hasActiveChat = selectedGroup !== null || selectedDirect !== null;

  const handleLeaveGroup = async (g: Group) => {
    const left = await leaveGroup(g.getGuid());
    if (left && selectedGroup?.getGuid() === g.getGuid()) setSelectedGroup(null);
  };

  return (
    <div className="flex flex-row w-full h-full">
      {/* Sidebar: full-width on mobile when no chat active, fixed 288px on sm+ */}
      <div className={`flex-shrink-0 sm:w-72 h-full ${hasActiveChat ? "hidden sm:block" : "w-full"}`}>
        <ChatSideBar
          groups={visibleGroups}
          directChats={directChats}
          selectedGroup={selectedGroup}
          selectedDirect={selectedDirect}
          onSelectGroup={(g) => { setSelectedGroup(g); setSelectedDirect(null); clearNewChatParam(); }}
          onSelectDirect={(e) => { setSelectedDirect(e); setSelectedGroup(null); clearNewChatParam(); }}
          onCloseGroup={handleLeaveGroup}
          onCloseDirect={(e) => { setDirectChats((prev) => prev.filter((d) => d.uid !== e.uid || d.title !== e.title)); if (selectedDirect?.uid === e.uid && selectedDirect?.title === e.title) setSelectedDirect(null); }}
          isCustomer={isCustomer}
          canLeaveChats={canLeaveChats}
          onCreateChat={() => setShowCreateModal(true)}
          showCustomerFilter={isAdmin}
          customerOptions={customerOptions}
          selectedCustomerId={selectedCustomerId}
          onSelectedCustomerIdChange={setSelectedCustomerId}
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
            <div className="flex flex-1 items-center justify-center text-muted-foreground text-sm md:smalltext">
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
          requireInitiative={isAdmin || isDeveloper}
          initiativeOptions={initiativeOptions}
        />
      )}
    </div>
  );
}
