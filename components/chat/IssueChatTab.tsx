"use client";

import { useQuery } from "@tanstack/react-query";
import { API_JSON_HEADERS } from "@/lib/api-headers";
import { IssueCometChat } from "./CometChat/IssueCometChat";
import { IssueRealtimeChat } from "./Realtime/IssueRealtimeChat";
import { ChatSpinner } from "./CometChat/ChatSpinner";

type CustomerSystemsRow = {
  clientName: string | null;
  systems: { chat?: string } | null;
};

// clientName shows up formatted differently depending on which flow
// produced it (raw vs slugified at onboarding) — fold case/spaces/hyphens
// so a slug from either flow still matches (same rationale as
// getOrCreateIssueGroup.ts's own normalizeSlug).
function normalizeSlug(value: string): string {
  return value.trim().toLowerCase().replaceAll(/[\s-]+/g, "-");
}

// The issue detail modal's "Chat" tab, resolved to whichever provider that
// issue's own project actually uses (customers.systems.chat) — same
// resolution ChatProvider.tsx does for the full chat pages, scoped down
// here since this tab only ever needs one project's answer and has no
// customer id handy, only its route slug.
export function IssueChatTab({
  issueId,
  issueTitle,
  slug,
}: {
  readonly issueId: string;
  readonly issueTitle: string;
  readonly slug?: string;
}) {
  const { data: customers, isLoading } = useQuery({
    queryKey: ["customers-systems"],
    queryFn: async () => {
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/users?type=customers`, {
        headers: API_JSON_HEADERS,
      });
      if (!res.ok) throw new Error("Failed to fetch customer systems");
      return res.json() as Promise<CustomerSystemsRow[]>;
    },
    enabled: !!slug,
  });

  // No slug to resolve against (shouldn't normally happen — every issue tab
  // is opened from some project route) — fall back to today's default
  // rather than blocking the tab on a lookup that can't succeed.
  if (!slug) return <IssueCometChat issueId={issueId} issueTitle={issueTitle} slug={slug} />;

  if (isLoading) return <ChatSpinner size="sm" label="Loading chat…" />;

  const normalizedSlug = normalizeSlug(slug);
  const chatProvider =
    customers?.find((c) => c.clientName && normalizeSlug(c.clientName) === normalizedSlug)?.systems?.chat ??
    "cometchat";

  if (chatProvider === "supabase_realtime") {
    return <IssueRealtimeChat issueId={issueId} issueTitle={issueTitle} slug={slug} />;
  }

  return <IssueCometChat issueId={issueId} issueTitle={issueTitle} slug={slug} />;
}
