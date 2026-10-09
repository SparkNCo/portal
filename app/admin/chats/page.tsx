"use client";

import { ChatRouteRedirect } from "@/components/chat/chat-route-redirect";

// Moved to /{slug}/chat — see components/chat/chat-route-redirect.tsx.
export default function AdminChatsRedirect() {
  return <ChatRouteRedirect />;
}
