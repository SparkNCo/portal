import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { IssueDetailTab } from "@/components/client/issues.types";

// Deep link from a notification (see NotificationBell.tsx's resolveLink):
// `?issueId=…&tab=…` asks the page to open that issue's detail modal. The
// params are read once into state and stripped from the URL straight away —
// left there, they'd reopen the modal on every reload and tag along in the
// URL long after the user moved on. The page keeps the deep link until the
// modal it opened is closed (`clearDeepLink`), so a background refetch of
// the issues list can't pop it back open afterwards either.
export function useIssueDeepLink() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const issueIdParam = searchParams.get("issueId");
  const tabParam = searchParams.get("tab");

  const [deepLink, setDeepLink] = useState<{ issueId: string; tab?: IssueDetailTab } | null>(null);

  useEffect(() => {
    if (!issueIdParam) return;
    setDeepLink({ issueId: issueIdParam, tab: (tabParam as IssueDetailTab | null) ?? undefined });

    const rest = new URLSearchParams(searchParams.toString());
    rest.delete("issueId");
    rest.delete("tab");
    const query = rest.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    // searchParams itself is a new object on every navigation — keyed on the
    // two values that matter instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issueIdParam, tabParam]);

  return {
    openIssueId: deepLink?.issueId ?? null,
    openIssueTab: deepLink?.tab,
    clearDeepLink: () => setDeepLink(null),
  };
}
