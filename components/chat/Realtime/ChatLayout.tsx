"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useUser } from "context/UserContext";
import { useCustomerSlug } from "context/CustomerSlugContext";
import { useSelectedProject } from "@/lib/selected-project-context";
import { usePinnedPanelsOwnerId } from "@/hooks/use-pinned-panels";
import { API_JSON_HEADERS } from "@/lib/api-headers";
import { ChevronLeft } from "lucide-react";
import RealtimeChatSideBar from "./RealtimeChatSideBar";
import RealtimeGroupChat from "./RealtimeGroupChat";
import CreateChatModal from "../CometChat/CreateChatModal";
import { useRealtimeChat, type Chat } from "./useRealtimeChat";

// Realtime (Supabase) equivalent of CometChat/ChatLayout.tsx. Deliberately
// narrower than that one for now:
//   - no direct chats (that list was never populated there either — dead
//     CometChat-era state, not reproduced here)
//   - no issue-linked chat creation yet (needs the issue_id/get-or-create
//     work tracked separately)
//   - no "leave chat" (chat_participants has no self-removal policy yet)
export default function ChatLayout({
  initialTitle,
  fallbackProjectSlug,
  controlledCustomerId,
  onControlledCustomerIdChange,
}: {
  readonly initialTitle?: string;
  readonly fallbackProjectSlug?: string;
  // SPA-513: see the identical props on CometChat/ChatLayout.tsx — lets
  // ChatProvider learn which customer an admin has filtered down to so it
  // can pick the right provider for *that* customer, instead of staying
  // stuck on whichever provider it first mounted.
  readonly controlledCustomerId?: string;
  readonly onControlledCustomerIdChange?: (id: string) => void;
}) {
  const { profile } = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const chatIdParam = searchParams.get("chatId");
  const customerSlug = useCustomerSlug();
  const { selectedProject } = useSelectedProject();
  const viewedCustomerId = usePinnedPanelsOwnerId();
  const customerId = customerSlug ? viewedCustomerId : undefined;
  const { chats, ready, error, profileLoading, refreshChats, createChat } = useRealtimeChat(customerId);

  const isAdmin = profile?.role === "admin";
  const isDeveloper = profile?.role === "developer";
  const isCustomer = profile?.role === "customer";
  const [internalSelectedCustomerId, setInternalSelectedCustomerId] = useState("");
  const selectedCustomerId = controlledCustomerId ?? internalSelectedCustomerId;
  const setSelectedCustomerId = onControlledCustomerIdChange ?? setInternalSelectedCustomerId;

  const { data: allUsers } = useQuery({
    queryKey: ["all-users-for-chat-filter"],
    queryFn: async () => {
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/users`, {
        headers: API_JSON_HEADERS,
      });
      if (!res.ok) throw new Error("Failed to fetch users");
      return res.json() as Promise<{ id: string; userName?: string; role: string }[]>;
    },
  });

  const userNameById = useMemo(
    () => new Map((allUsers ?? []).map((u) => [u.id, u.userName ?? u.id])),
    [allUsers],
  );

  const customerOptions = useMemo(() => {
    return (allUsers ?? [])
      .filter((u) => u.role === "customer" && u.userName)
      .map((u) => ({ id: u.id, userName: u.userName! }))
      .sort((a, b) => a.userName.localeCompare(b.userName));
  }, [allUsers]);

  useEffect(() => {
    if (!selectedCustomerId && customerOptions.length > 0) {
      setSelectedCustomerId(customerOptions[0]!.id);
    }
  }, [customerOptions, selectedCustomerId]);

  const selectedProjectClientName = isDeveloper
    ? (selectedProject ?? profile?.assignment_id?.[0]?.clientName ?? null)
    : null;
  const selectedProjectCustomerId = selectedProjectClientName
    ? (profile?.assignment_id?.find((a) => a.clientName === selectedProjectClientName)?.customer_id ?? null)
    : null;

  const { data: developerAssignments } = useQuery({
    queryKey: ["developer-initiatives-for-chat", profile?.id],
    queryFn: async () => {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/assignments?developer=${profile!.id}`,
        { headers: API_JSON_HEADERS },
      );
      if (!res.ok) throw new Error("Failed to fetch assignments");
      return res.json() as Promise<{ customer_id: string; clientName?: string | null }[]>;
    },
    enabled: isDeveloper && !!profile?.id,
  });

  const initiativeOptions = useMemo(() => {
    if (isAdmin) return customerOptions.map((c) => ({ id: c.id, label: c.userName }));
    if (isDeveloper) {
      const byId = new Map<string, string>();
      for (const a of developerAssignments ?? []) {
        if (a.customer_id && !byId.has(a.customer_id)) byId.set(a.customer_id, a.clientName ?? a.customer_id);
      }
      return Array.from(byId.entries()).map(([id, label]) => ({ id, label })).sort((a, b) => a.label.localeCompare(b.label));
    }
    return [];
  }, [isAdmin, isDeveloper, customerOptions, developerAssignments]);

  const clearNewChatParam = () => router.replace(pathname);

  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!ready) return;
    if (initialTitle) setShowCreateModal(true);
  }, [ready]);

  // Deep link from a chat notification (see NotificationBell.tsx's
  // resolveLink) — selects the target chat once it's loaded, regardless of
  // the admin/developer customer filter, since a notification recipient is
  // necessarily already a participant. Retries as `chats` updates in case
  // the initial fetch raced the participant row being seeded.
  useEffect(() => {
    if (!ready || !chatIdParam) return;
    const match = chats.find((c) => c.id === chatIdParam);
    if (match) {
      setSelectedChat(match);
      clearNewChatParam();
    }
  }, [ready, chatIdParam, chats]);

  const projectSlug = customerSlug ?? fallbackProjectSlug ?? undefined;

  const handleCreate = async (title: string, initiativeId?: string, issue?: unknown) => {
    setCreating(true);
    try {
      if (issue) {
        // Issue-linked chats aren't wired up yet on the Realtime side.
        console.warn("Issue-linked chat creation isn't implemented for the Realtime provider yet.");
      }
      const created = await createChat(title, initiativeId ?? customerId, projectSlug);
      if (created) {
        const list = await refreshChats();
        setSelectedChat(list.find((c) => c.id === created.id) ?? created);
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

  const groupCustomerFilter = isAdmin
    ? selectedCustomerId
    : isDeveloper
      ? selectedProjectCustomerId
      : null;
  const visibleChats = groupCustomerFilter
    ? chats.filter((c) => c.metadata?.customerId === groupCustomerFilter)
    : chats;
  const hasActiveChat = selectedChat !== null;

  return (
    <div className="flex flex-row w-full h-full">
      <div className={`flex-shrink-0 sm:w-72 h-full ${hasActiveChat ? "hidden sm:block" : "w-full"}`}>
        <RealtimeChatSideBar
          chats={visibleChats}
          selectedChat={selectedChat}
          onSelectChat={(c) => { setSelectedChat(c); clearNewChatParam(); }}
          onCreateChat={() => setShowCreateModal(true)}
          showCustomerFilter={isAdmin}
          customerOptions={customerOptions}
          selectedCustomerId={selectedCustomerId}
          onSelectedCustomerIdChange={setSelectedCustomerId}
        />
      </div>

      <div className={`flex-col flex-1 overflow-hidden ${hasActiveChat ? "flex" : "hidden sm:flex"}`}>
        {hasActiveChat && (
          <button
            onClick={() => setSelectedChat(null)}
            className="sm:hidden flex items-center gap-1.5 px-4 py-2 border-b text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to chats
          </button>
        )}
        <div className="flex flex-1 overflow-hidden">
          {selectedChat && profile?.id && (
            <RealtimeGroupChat chat={selectedChat} currentUserId={profile.id} userNameById={userNameById} />
          )}
          {!selectedChat && (
            <div className="flex flex-1 items-center justify-center text-muted-foreground text-sm md:smalltext">
              {visibleChats.length === 0 ? "No chats yet." : "Select a chat to start messaging."}
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
          requireInitiative={isAdmin || isDeveloper || isCustomer}
          initiativeOptions={initiativeOptions}
          lockedInitiativeId={isDeveloper ? (selectedProjectCustomerId ?? undefined) : undefined}
          fixedSlug={isCustomer ? projectSlug : undefined}
        />
      )}
    </div>
  );
}
