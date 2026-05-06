"use client";

import { Header } from "@/components/headerDashboard";
import { ProgressPieChart } from "@/components/client/progress-pie-chart";
import { PriorityTasks } from "@/components/client/priority-tasks";
import { LoadingDataPanel } from "@/components/loader";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { useRouter, usePathname, useParams } from "next/navigation";
import { CreateIssue } from "@/components/shared/create-issue";
import { PolicyApprovalModal } from "@/components/ui/PolicyApprovalModal";
import { useUser } from "context/UserContext";
import { useCustomerSlug } from "context/CustomerSlugContext";

export async function fetchIssues(slug: string, ticketStatuses: string[] = []) {
  const statuses = [...new Set(ticketStatuses)];

  const params = new URLSearchParams({
    slug,
    ticket_statuses: statuses.join(","),
  });
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_ENDPOINT}/issues?${params.toString()}`,
  );
  if (!res.ok) throw new Error("Failed to fetch issues");
  return res.json();
}

export async function fetchPoliciesStatus(userId: string) {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_ENDPOINT}/agreePolicies/check?user_id=${userId}`,
  );
  if (!res.ok) throw new Error("Failed to fetch policy status");
  return res.json();
}

export default function ClientDashboard() {
  const { profile } = useUser();
  const customerSlug = useCustomerSlug();
  const { slug: urlSlug } = useParams<{ slug: string }>();
  const router = useRouter();
  const pathname = usePathname();
  const slug = customerSlug ?? urlSlug ?? profile?.linear_slug ?? "";
  const userId = profile?.id;
  const linearProjectId = "";
  const notionUrl = "https://www.notion.so/YOUR_POLICIES";
  const [showPoliciesModal, setShowPoliciesModal] = useState(false);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [onlyActive, setOnlyActive] = useState(false);
  const [allIssuePage, setAllIssuePage] = useState(1);
  const ALL_PAGE_SIZE = 10;

  // 🔹 Issues query
  const { data: issuesData, isLoading: issuesLoading } = useQuery({
    queryKey: ["linear-issues", slug],
    queryFn: () => fetchIssues(slug),
    enabled: !!slug,
  });

  // 🔹 Issue questions query
  const { data: questionsData } = useQuery<{ countByIssue: Record<string, number> }>({
    queryKey: ["issue-questions", userId],
    queryFn: async () => {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_ENDPOINT}/issue-questions?user_id=${userId}`,
        {
          headers: {
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_APIKEY}`,
            apikey: process.env.NEXT_PUBLIC_APIKEY!,
          },
        },
      );
      if (!res.ok) throw new Error("Failed to fetch issue questions");
      return res.json();
    },
    enabled: !!userId,
  });

  const questionCounts = questionsData?.countByIssue ?? {};

  // 🔹 Policies approval query
  const { data: policiesStatus, isLoading: policiesLoading } = useQuery<
    { approved: boolean },
    Error
  >({
    queryKey: ["policies-status", userId],
    queryFn: () => fetchPoliciesStatus(userId!),
    enabled: !!userId && profile?.role === "developer",
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (policiesStatus && !policiesStatus.approved) {
      setShowPoliciesModal(true);
    }
  }, [policiesStatus]);

  const allIssues: any[] = issuesData ?? [];
  const availableStatuses = Array.from(
    new Set(allIssues.map((i: any) => i.state?.name).filter(Boolean)),
  ) as string[];
  const hasCycles = allIssues.some((i: any) => i.cycle !== undefined);

  const filteredIssues = allIssues
    .filter((issue: any) => {
      if (onlyActive && issue.cycle && !issue.cycle.isActive) return false;
      if (
        selectedStatuses.length > 0 &&
        (!issue.state?.name || !selectedStatuses.includes(issue.state.name))
      )
        return false;
      return true;
    })
    .sort((a: any, b: any) => {
      const aCount = questionCounts[a.id] ?? 0;
      const bCount = questionCounts[b.id] ?? 0;
      return bCount - aCount;
    });

  const priorityIssues = filteredIssues.filter(
    (i: any) => i.state?.name === "UAT" || i.state?.name === "Business Review",
  );

  const totalPages = Math.max(
    1,
    Math.ceil(filteredIssues.length / ALL_PAGE_SIZE),
  );
  const pagedIssues = filteredIssues.slice(
    (allIssuePage - 1) * ALL_PAGE_SIZE,
    allIssuePage * ALL_PAGE_SIZE,
  );

  const handleOpenChat = (title: string) => {
    const chatPath = pathname.replace(/\/[^/]+$/, "/chat");
    router.push(`${chatPath}?newChat=${encodeURIComponent(title)}`);
  };

  const filterState = {
    selectedStatuses,
    onlyActive,
    availableStatuses,
    hasCycles,
    onToggleStatus: (s: string) =>
      setSelectedStatuses((prev) =>
        prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
      ),
    onToggleActive: () => setOnlyActive((v) => !v),
    onClearFilters: () => {
      setSelectedStatuses([]);
      setOnlyActive(false);
    },
  };

  const linearOAuthUrl = `https://linear.app/oauth/authorize?client_id=${process.env.NEXT_PUBLIC_LINEAR_CLIENT_ID}&redirect_uri=${encodeURIComponent(process.env.NEXT_PUBLIC_LINEAR_REDIRECT_URI ?? "")}&response_type=code&scope=write&state=${userId}`;

  if (issuesLoading || policiesLoading) return <LoadingDataPanel />;

  return (
    <div className="min-h-screen">
      <PolicyApprovalModal
        open={showPoliciesModal}
        userId={userId!}
        notionUrl={notionUrl}
        onApproved={() => setShowPoliciesModal(false)}
      />
      <Header
        title="Client Dashboard"
        subtitle={`Welcome back, ${profile?.email ?? "User"}`}
      />
      {!profile?.linear_access_token && (
        <div className="mx-4 md:mx-6 mt-4 flex items-center justify-between gap-3 rounded-lg border border-warning/30 bg-warning/10 px-4 py-3">
          <p className="text-sm text-warning font-medium">
            Connect your Linear account to post comments as yourself.
          </p>
          <a
            href={linearOAuthUrl}
            className="shrink-0 rounded-md bg-warning text-warning-foreground text-xs font-semibold px-3 py-1.5 hover:opacity-90 transition-opacity"
          >
            Connect Linear
          </a>
        </div>
      )}
      <div className="p-4 md:p-6 space-y-6">
        {/* Priority view — UAT & Business Review only */}
        <div className="flex flex-col md:flex-row gap-4 md:gap-6 items-stretch">
          <div className="w-full md:w-1/3 flex flex-col">
            <ProgressPieChart issuesData={allIssues} />
          </div>
          <div className="w-full md:w-2/3 flex flex-col">
            <PriorityTasks
              issuesData={priorityIssues}
              filterState={filterState}
              onOpenChat={handleOpenChat}
              questionCounts={questionCounts}
            />
          </div>
        </div>

        {/* All issues — paginated */}
        <div className="w-full flex flex-col gap-3">
            <PriorityTasks
              issuesData={pagedIssues}
              filterState={filterState}
              onOpenChat={handleOpenChat}
              title="All Tasks"
              questionCounts={questionCounts}
            />
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-3 text-sm text-muted-foreground">
                <button
                  className="px-3 py-1 rounded-md border border-border hover:bg-secondary/60 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  onClick={() => setAllIssuePage((p) => Math.max(1, p - 1))}
                  disabled={allIssuePage === 1}
                >
                  ← Prev
                </button>
                <span>
                  Page {allIssuePage} of {totalPages}
                </span>
                <button
                  className="px-3 py-1 rounded-md border border-border hover:bg-secondary/60 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  onClick={() =>
                    setAllIssuePage((p) => Math.min(totalPages, p + 1))
                  }
                  disabled={allIssuePage === totalPages}
                >
                  Next →
                </button>
              </div>
            )}
        </div>

        <CreateIssue slug={slug} projectId={linearProjectId} profile={profile} />
      </div>
    </div>
  );
}
