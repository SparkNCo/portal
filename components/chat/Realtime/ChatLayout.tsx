"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import CreateChatModal, { type ChatIssueOption } from "../CometChat/CreateChatModal";
import { useRealtimeChat, type Chat } from "./useRealtimeChat";

const CHATS_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/chats`;

// Realtime (Supabase) equivalent of CometChat/ChatLayout.tsx. Deliberately
// narrower than that one for now:
//   - no direct chats (that list was never populated there either — dead
//     CometChat-era state, not reproduced here)
//   - no issue-linked chat creation yet (needs the issue_id/get-or-create
//     work tracked separately)
//   - no "leave chat" (chat_participants has no self-removal policy yet)
const OWN_PROVIDER = "supabase_realtime";

export default function ChatLayout({
  initialTitle,
  fallbackProjectSlug,
  controlledCustomerId,
  onControlledCustomerIdChange,
  customerSystemsById,
  pendingCreate,
  onPendingCreateHandled,
  onCrossProviderCreate,
}: {
  readonly initialTitle?: string;
  readonly fallbackProjectSlug?: string;
  // SPA-513: see the identical props on CometChat/ChatLayout.tsx — lets
  // ChatProvider learn which customer an admin has filtered down to so it
  // can pick the right provider for *that* customer, instead of staying
  // stuck on whichever provider it first mounted.
  readonly controlledCustomerId?: string;
  readonly onControlledCustomerIdChange?: (id: string) => void;
  // SPA-513: admin-only "New Chat" lets you pick any initiative, which can
  // use a *different* provider than whatever's mounted right now — see
  // handleCreate below and ChatProvider.tsx's handleCrossProviderCreate.
  readonly customerSystemsById?: Map<string, string>;
  readonly pendingCreate?: { title: string; initiativeId?: string; issue?: unknown } | null;
  readonly onPendingCreateHandled?: () => void;
  readonly onCrossProviderCreate?: (title: string, initiativeId: string | undefined, issue: unknown) => void;
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

  // Resumes a creation ChatProvider handed off after switching us in for a
  // different provider (see handleCreate above / ChatProvider.tsx's
  // handleCrossProviderCreate). The ref guards against firing twice if this
  // effect re-runs before onPendingCreateHandled's state update lands (e.g.
  // React 18 Strict Mode's double-invoke in dev).
  const handledPendingCreateRef = useRef(false);
  useEffect(() => {
    if (!ready || !pendingCreate || handledPendingCreateRef.current) return;
    handledPendingCreateRef.current = true;
    handleCreate(pendingCreate.title, pendingCreate.initiativeId, pendingCreate.issue as ChatIssueOption | undefined);
    onPendingCreateHandled?.();
  }, [ready, pendingCreate]);

  // Deep link from a chat notification (see NotificationBell.tsx's
  // resolveLink) — selects the target chat once it's loaded. A notification
  // recipient is necessarily already a participant, so the chat itself opens
  // regardless of the admin customer filter — but the sidebar's own
  // `visibleChats` is filtered by that same `selectedCustomerId` (see
  // groupCustomerFilter below), so without also updating it here the
  // sidebar kept showing whichever customer it defaulted to (the first one
  // alphabetically) instead of the chat's actual customer. Retries as
  // `chats` updates in case the initial fetch raced the participant row
  // being seeded.
  useEffect(() => {
    if (!ready || !chatIdParam) return;
    const match = chats.find((c) => c.id === chatIdParam);
    if (match) {
      setSelectedChat(match);
      if (isAdmin && match.metadata?.customerId) {
        setSelectedCustomerId(match.metadata.customerId);
      }
      clearNewChatParam();
    }
  }, [ready, chatIdParam, chats, isAdmin]);

  const projectSlug = customerSlug ?? fallbackProjectSlug ?? undefined;

  const handleCreate = async (title: string, initiativeId?: string, issue?: ChatIssueOption) => {
    // The picked initiative can use a different provider than this one —
    // hand off to ChatProvider instead of creating it here under the wrong
    // system. Harmless/never true for developer/customer, whose initiative
    // is always locked/fixed to the same customer this layout already
    // resolved from.
    if (initiativeId && customerSystemsById) {
      const targetProvider = customerSystemsById.get(initiativeId) ?? "cometchat";
      if (targetProvider !== OWN_PROVIDER) {
        setShowCreateModal(false);
        onCrossProviderCreate?.(title, initiativeId, issue);
        return;
      }
    }

    setCreating(true);
    try {
      // A chat tied to a ticket must be the *same* chat that ticket's own
      // Chat tab uses (see IssueChatTab.tsx / IssueRealtimeChat.tsx) — that
      // tab looks up the one deterministic issue chat by issue_id, not "any
      // chat whose metadata happens to mention this issue." The initiative
      // picked in the modal resolves this issue's project slug the same way
      // projectSlug otherwise would (mirrors CometChat/ChatLayout.tsx).
      const issueSlug = initiativeId
        ? initiativeOptions.find((o) => o.id === initiativeId)?.label
        : undefined;
      const created = issue
        ? await createOrGetIssueChat(issue.id, issue.title, issueSlug ?? projectSlug)
        : await createChat(title, initiativeId ?? customerId, projectSlug);
      if (created) {
        const list = await refreshChats();
        setSelectedChat(list.find((c) => c.id === created.id) ?? created);
      }
      setShowCreateModal(false);
    } finally {
      setCreating(false);
    }
  };

  const createOrGetIssueChat = async (
    issueId: string,
    issueTitle: string,
    slugForIssue: string | undefined,
  ): Promise<Chat | null> => {
    if (!profile) return null;
    try {
      const res = await fetch(`${CHATS_URL}?type=issue`, {
        method: "POST",
        headers: API_JSON_HEADERS,
        body: JSON.stringify({
          issueId,
          issueTitle,
          slug: slugForIssue,
          profile: { id: profile.id, role: profile.role },
        }),
      });
      if (!res.ok) throw new Error("Failed to create issue chat");
      return (await res.json()) as Chat;
    } catch (err) {
      console.error("Create issue chat error:", err);
      return null;
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
