import { supabase } from "@/lib/supabase-client";
import { API_JSON_HEADERS } from "@/lib/api-headers";
import { routeSlugFor } from "@/lib/developer-routes";

type ProfileForChatLinks = {
  role?: string;
  assignment_id?: unknown;
} | null | undefined;

// Chat lives at /{slug}/chat for every role, but a chat notification (or an
// old /admin/chats / /dev/chat link) only carries the chat's id. This finds
// the route slug of the customer that chat belongs to: first from
// metadata.customerId (the customer's user id, set when the chat is
// created), mapped to that customer's clientName; then from the chat's own
// project_slug. Realtime chats only — CometChat groups aren't in
// portal.chats, but chat notifications are only ever sent for Realtime
// chats (notify_chat_message).
export async function resolveChatRouteSlug(chatId: string, profile: ProfileForChatLinks): Promise<string | null> {
  const { data: chat, error } = await supabase
    .schema("portal")
    .from("chats")
    .select("project_slug, metadata")
    .eq("id", chatId)
    .maybeSingle();
  if (error || !chat) return null;

  const customerId: string | undefined = (chat.metadata as { customerId?: string } | null)?.customerId;
  if (customerId) {
    const clientName = await clientNameForCustomer(customerId, profile);
    if (clientName) return routeSlugFor(clientName);
  }
  return chat.project_slug ? routeSlugFor(chat.project_slug) : null;
}

async function clientNameForCustomer(customerId: string, profile: ProfileForChatLinks): Promise<string | null> {
  const assignments = Array.isArray(profile?.assignment_id) ? (profile.assignment_id as any[]) : [];
  const assigned = assignments.find((a) => a?.customer_id === customerId)?.clientName;
  if (assigned) return assigned;
  if (profile?.role !== "admin") return null;

  const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/users?type=customers`, {
    headers: API_JSON_HEADERS,
  });
  if (!res.ok) return null;
  const customers: { id: string; clientName: string | null }[] = await res.json();
  return customers.find((c) => c.id === customerId)?.clientName ?? null;
}
