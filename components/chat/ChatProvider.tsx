"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useUser } from "context/UserContext";
import { useCustomerSlug } from "context/CustomerSlugContext";
import { useSelectedProject } from "@/lib/selected-project-context";
import { usePinnedPanelsOwnerId } from "@/hooks/use-pinned-panels";
import { API_JSON_HEADERS } from "@/lib/api-headers";
import CometChatLayout from "./CometChat/ChatLayout";
import RealtimeChatLayout from "./Realtime/ChatLayout";
import { LoadingDataPanel } from "@/components/loader";

type CustomerSystemsRow = {
  id: string;
  systems: { chat?: string; vector?: string } | null;
};

type Assignment = { customer_id: string; clientName?: string | null };

// Same resolution ChatLayout already does for its own developer group
// filter — derived from shared context/profile data, not local state, so
// keeping this outside the component doesn't cost any reactivity.
function resolveSelectedProjectCustomerId(
  selectedProject: string | null | undefined,
  assignments: Assignment[] | undefined,
): string | undefined {
  const clientName = selectedProject ?? assignments?.[0]?.clientName ?? null;
  if (!clientName) return undefined;
  return assignments?.find((a) => a.clientName === clientName)?.customer_id ?? undefined;
}

// Whichever customer's config actually governs this chat panel: the
// customer being viewed via a `[slug]` route, the one an admin has filtered
// the unscoped inbox down to, the one a developer's project dropdown is
// set to, or a logged-in customer's own account.
function resolveRelevantCustomerUserId(args: {
  customerSlug: string | null | undefined;
  viewedCustomerId: string | undefined;
  isAdmin: boolean;
  adminSelectedCustomerId: string;
  isDeveloper: boolean;
  selectedProjectCustomerId: string | undefined;
  isCustomer: boolean;
  ownProfileId: string | undefined;
}): string | undefined {
  if (args.customerSlug) return args.viewedCustomerId;
  if (args.isAdmin) return args.adminSelectedCustomerId || undefined;
  if (args.isDeveloper) return args.selectedProjectCustomerId;
  if (args.isCustomer) return args.ownProfileId;
  return undefined;
}

// SPA-513: reads the relevant customer's `customers.systems.chat` (see
// 20260921120000_add_systems_config_and_chat_tables.sql) and mounts the
// matching chat implementation. Defaults to CometChat — the migration's
// `systems` default is `{"chat": "cometchat", ...}`, so any customer with no
// opinion, or while this query is still loading, gets today's behavior
// rather than flashing/mounting the Realtime provider speculatively.
export default function ChatProvider({
  initialTitle,
  fallbackProjectSlug,
}: {
  readonly initialTitle?: string;
  readonly fallbackProjectSlug?: string;
}) {
  const { profile } = useUser();
  const customerSlug = useCustomerSlug();
  const viewedCustomerId = usePinnedPanelsOwnerId();
  const { selectedProject } = useSelectedProject();

  const isAdmin = profile?.role === "admin";
  const isDeveloper = profile?.role === "developer";

  // Admin: which customer the *unscoped* inbox is filtered down to. Neither
  // ChatLayout owns this state itself when controlledCustomerId is passed
  // in (see CometChat/ChatLayout.tsx and Realtime/ChatLayout.tsx) — it's
  // lifted up here instead, so switching customers can also switch which
  // provider is mounted. Starts empty; whichever ChatLayout mounts first
  // populates it via onControlledCustomerIdChange as soon as its own
  // customer list loads (same "default to the first customer
  // alphabetically" behavior as before), which may cause one provider
  // swap right after initial mount — an acceptable one-time flash in
  // exchange for not duplicating that list/sort logic a third time here.
  const [adminSelectedCustomerId, setAdminSelectedCustomerId] = useState("");

  // Set when an admin submits "New Chat" for an initiative whose own
  // systems.chat differs from whatever's currently mounted (see
  // handleCrossProviderCreate below) — the sidebar filter switches to that
  // initiative, which remounts the *other* ChatLayout, and this is handed to
  // it so it can finish the creation that started under the wrong provider.
  const [pendingCreate, setPendingCreate] = useState<{
    title: string;
    initiativeId?: string;
    issue?: unknown;
  } | null>(null);

  const selectedProjectCustomerId = isDeveloper
    ? resolveSelectedProjectCustomerId(selectedProject, profile?.assignment_id)
    : undefined;

  const relevantCustomerUserId = resolveRelevantCustomerUserId({
    customerSlug,
    viewedCustomerId,
    isAdmin,
    adminSelectedCustomerId,
    isDeveloper,
    selectedProjectCustomerId,
    isCustomer: profile?.role === "customer",
    ownProfileId: profile?.id,
  });

  // Admins always need the full list (not just the currently-viewed
  // customer's row) — "New Chat" lets them freely pick *any* initiative,
  // and that pick can name a customer other than the one currently
  // governing this view (see handleCrossProviderCreate).
  const { data: customers, isLoading } = useQuery({
    queryKey: ["customers-systems"],
    queryFn: async () => {
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/users?type=customers`, {
        headers: API_JSON_HEADERS,
      });
      if (!res.ok) throw new Error("Failed to fetch customer systems");
      return res.json() as Promise<CustomerSystemsRow[]>;
    },
    enabled: !!relevantCustomerUserId || isAdmin,
  });

  const customerSystemsById = new Map(
    (customers ?? []).map((c) => [c.id, c.systems?.chat ?? "cometchat"]),
  );

  // A chat created for a specific initiative must actually land in *that*
  // initiative's own provider — the free-choice "Initiative" dropdown in
  // New Chat (admin only; developers/customers are locked to their own) can
  // name a customer other than whichever one is currently governing this
  // view. When that happens, switch the view to the target customer (which
  // remounts the correct ChatLayout) and hand it what to create once ready.
  const handleCrossProviderCreate = (title: string, initiativeId: string | undefined, issue: unknown) => {
    if (!initiativeId) return;
    setPendingCreate({ title, initiativeId, issue });
    setAdminSelectedCustomerId(initiativeId);
  };

  if (relevantCustomerUserId && isLoading) {
    return <LoadingDataPanel />;
  }

  const chatProvider = relevantCustomerUserId
    ? (customers?.find((c) => c.id === relevantCustomerUserId)?.systems?.chat ?? "cometchat")
    : "cometchat";

  if (chatProvider === "supabase_realtime") {
    return (
      <RealtimeChatLayout
        initialTitle={initialTitle}
        fallbackProjectSlug={fallbackProjectSlug}
        controlledCustomerId={isAdmin ? adminSelectedCustomerId : undefined}
        onControlledCustomerIdChange={isAdmin ? setAdminSelectedCustomerId : undefined}
        customerSystemsById={isAdmin ? customerSystemsById : undefined}
        pendingCreate={pendingCreate}
        onPendingCreateHandled={() => setPendingCreate(null)}
        onCrossProviderCreate={isAdmin ? handleCrossProviderCreate : undefined}
      />
    );
  }

  return (
    <CometChatLayout
      initialTitle={initialTitle}
      fallbackProjectSlug={fallbackProjectSlug}
      controlledCustomerId={isAdmin ? adminSelectedCustomerId : undefined}
      onControlledCustomerIdChange={isAdmin ? setAdminSelectedCustomerId : undefined}
      customerSystemsById={isAdmin ? customerSystemsById : undefined}
      pendingCreate={pendingCreate}
      onPendingCreateHandled={() => setPendingCreate(null)}
      onCrossProviderCreate={isAdmin ? handleCrossProviderCreate : undefined}
    />
  );
}
