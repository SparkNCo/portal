"use client";

import { useQuery } from "@tanstack/react-query";
import { useUser } from "context/UserContext";
import { useCustomerSlug } from "context/CustomerSlugContext";
import { useSelectedProject } from "@/lib/selected-project-context";
import { usePinnedPanelsOwnerId } from "@/hooks/use-pinned-panels";
import { pickDeveloperProject } from "@/lib/developer-routes";
import { API_JSON_HEADERS } from "@/lib/api-headers";
import CometChatLayout from "./CometChat/ChatLayout";
import RealtimeChatLayout from "./Realtime/ChatLayout";
import { LoadingDataPanel } from "@/components/loader";

type CustomerSystemsRow = {
  id: string;
  clientName: string | null;
  systems: { chat?: string; vector?: string } | null;
};

type Assignment = { customer_id: string; clientName?: string | null };

// Chat lives at /{slug}/chat for every role, so the slug decides whose chat
// this is:
// - admin: the customer in the URL (CustomerSlugContext, set by the [slug]
//   layout for admins)
// - developer: the assigned initiative matching the URL slug
// - customer: their own account (stakeholders have no customer of their own
//   and keep the default provider)
function resolveRelevantCustomerUserId(args: {
  isAdmin: boolean;
  viewedCustomerId: string | undefined;
  developerCustomerId: string | undefined;
  isCustomer: boolean;
  ownProfileId: string | undefined;
}): string | undefined {
  if (args.isAdmin) return args.viewedCustomerId;
  if (args.developerCustomerId) return args.developerCustomerId;
  if (args.isCustomer) return args.ownProfileId;
  return undefined;
}

// SPA-513: reads the relevant customer's `customers.systems.chat` (see
// 20260921120000_add_systems_config_and_chat_tables.sql) and mounts the
// matching chat implementation. Defaults to CometChat — the migration's
// `systems` default is `{"chat": "cometchat", ...}`, so any customer with no
// opinion gets today's behavior.
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

  const assignments = profile?.assignment_id as Assignment[] | undefined;
  const developerProject = isDeveloper ? pickDeveloperProject(profile, fallbackProjectSlug, selectedProject) : null;
  const developerCustomerId = developerProject
    ? assignments?.find((a) => a.clientName === developerProject)?.customer_id
    : undefined;

  const relevantCustomerUserId = resolveRelevantCustomerUserId({
    isAdmin,
    viewedCustomerId: customerSlug ? viewedCustomerId : undefined,
    developerCustomerId,
    isCustomer: profile?.role === "customer",
    ownProfileId: profile?.id,
  });

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

  if ((relevantCustomerUserId || isAdmin) && isLoading) {
    return <LoadingDataPanel />;
  }

  // An admin's inbox is always one customer's — the one in the URL. Until
  // the slug resolves to a customer there's nothing to scope it to, and
  // rendering the layout unscoped would briefly list every customer's chats.
  if (isAdmin && !viewedCustomerId) {
    const slugExists = customers?.some(
      (c) => c.clientName?.toLowerCase() === (customerSlug ?? "").toLowerCase(),
    );
    if (slugExists !== false) return <LoadingDataPanel />;
    return (
      <div className="flex flex-1 items-center justify-center p-6 smalltext text-muted-foreground">
        No customer matches this URL. Pick an initiative from the sidebar.
      </div>
    );
  }

  const chatProvider = relevantCustomerUserId
    ? (customers?.find((c) => c.id === relevantCustomerUserId)?.systems?.chat ?? "cometchat")
    : "cometchat";

  // Admins are scoped to the URL's customer: the layouts' own customer
  // filter is fixed to it (no-op setter), and New Chat is locked to it (see
  // lockedInitiativeId in the layouts). To chat with another customer, the
  // admin picks it in the sidebar's Initiative dropdown.
  const adminScope = isAdmin
    ? { controlledCustomerId: viewedCustomerId, onControlledCustomerIdChange: () => {} }
    : {};

  if (chatProvider === "supabase_realtime") {
    return (
      <RealtimeChatLayout initialTitle={initialTitle} fallbackProjectSlug={fallbackProjectSlug} {...adminScope} />
    );
  }

  return <CometChatLayout initialTitle={initialTitle} fallbackProjectSlug={fallbackProjectSlug} {...adminScope} />;
}
