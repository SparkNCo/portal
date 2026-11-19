import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import type { Issue, IssueDetailTab } from "@/components/client/issues.types";
import { API_HEADERS } from "@/lib/api-headers";
import { getIssueCode } from "@/lib/utils";

// A ticket's readable number (SPA-123): Jira tickets carry their key, Linear
// ones have it in their branch name.
export function issueCodeOf(issue: { identifier?: string | null; branchName?: string | null }): string {
  return (issue.identifier ?? (issue.branchName ? getIssueCode(issue.branchName) : "")).toUpperCase();
}

// A ticket number rather than an id (Linear UUID, or `jira:{customer}:{key}`).
const TICKET_CODE_RE = /^[a-z][a-z0-9]*-\d+$/i;
export const isTicketCode = (ref: string) => TICKET_CODE_RE.test(ref);

// Whether `issue` is the one a deep link names, by id or by ticket number.
export function matchesIssueRef(issue: { id: string; identifier?: string | null; branchName?: string | null }, ref: string | null): boolean {
  if (!ref) return false;
  return issue.id === ref || (isTicketCode(ref) && issueCodeOf(issue) === ref.toUpperCase());
}

// Deep link from a notification (see NotificationBell.tsx's resolveLink) or a
// link copied from the ticket's detail modal (issueShareUrl below):
// `?ticket=SPA-123&tab=…` (or `?issueId=…`, the id, from notifications and
// older links) asks the page to open that issue's detail modal. The
// params are read once into state and stripped from the URL straight away —
// left there, they'd reopen the modal on every reload and tag along in the
// URL long after the user moved on. The page keeps the deep link until the
// modal it opened is closed (`clearDeepLink`), so a background refetch of
// the issues list can't pop it back open afterwards either.
export function useIssueDeepLink() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const issueIdParam = searchParams.get("issueId") ?? searchParams.get("ticket");
  const tabParam = searchParams.get("tab");

  const [deepLink, setDeepLink] = useState<{ issueId: string; tab?: IssueDetailTab } | null>(null);

  useEffect(() => {
    if (!issueIdParam) return;
    setDeepLink({ issueId: issueIdParam, tab: (tabParam as IssueDetailTab | null) ?? undefined });

    const rest = new URLSearchParams(searchParams.toString());
    rest.delete("issueId");
    rest.delete("ticket");
    rest.delete("tab");
    const query = rest.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    // searchParams itself is a new object on every navigation — keyed on the
    // two values that matter instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issueIdParam, tabParam]);

  return {
    // An id or a ticket number: compare with matchesIssueRef.
    openIssueId: deepLink?.issueId ?? null,
    openIssueTab: deepLink?.tab,
    clearDeepLink: () => setDeepLink(null),
  };
}

// The deep-linked issue when the page's own lists don't have it (another
// status, label removed since…): fetched by id, and only if it belongs to
// this initiative (`slug`) — a shared link to another customer's ticket
// opens nothing. Not found or not theirs: says so and drops the link.
export function useDeepLinkedIssueFallback({
  issueId,
  slug,
  enabled,
  onUnavailable,
}: {
  issueId: string | null;
  slug: string;
  enabled: boolean;
  onUnavailable: () => void;
}) {
  const { data, isError } = useQuery({
    queryKey: ["issue-by-id", issueId, slug],
    queryFn: async () => {
      // A ticket number is looked up within this initiative (`code`).
      const key = isTicketCode(issueId ?? "") ? "code" : "id";
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/issues/by-id?${key}=${encodeURIComponent(issueId ?? "")}&slug=${encodeURIComponent(slug)}`,
        { headers: API_HEADERS },
      );
      if (!res.ok) throw new Error("Failed to fetch issue");
      return res.json() as Promise<Issue>;
    },
    enabled: enabled && !!issueId && !!slug,
    retry: false,
  });

  useEffect(() => {
    if (!isError || !issueId) return;
    toast.error("That ticket isn't available", {
      id: "deep-link-unavailable",
      description: "It may have been deleted, or it isn't part of this initiative.",
    });
    onUnavailable();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isError, issueId]);

  return issueId ? data : undefined;
}

// The link the detail modal's "Copy link" button copies (SPA-500 / SPA-600):
// the initiative's Monitor page with the ticket's number and `tab`, e.g.
// /acme/monitor?ticket=SPA-123&tab=decisions. Monitor opens it; developers,
// who have no Monitor, are sent to their Developer page with the same
// ticket (the portal layout carries `ticket` / `tab` over). Someone signed
// out logs in first and comes back to it (AuthGate); the initiative's access
// check and the fallback above decide whether it opens.
export function issueShareUrl(origin: string, slug: string, ticketCode: string, tab?: IssueDetailTab) {
  const params = new URLSearchParams({ ticket: ticketCode.toUpperCase() });
  if (tab && tab !== "description") params.set("tab", tab);
  return `${origin}/${encodeURIComponent(slug.toLowerCase())}/monitor?${params.toString()}`;
}
