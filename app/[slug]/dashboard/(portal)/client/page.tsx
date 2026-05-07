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

  // 🔹 Issues query
  const { data: issuesData, isLoading: issuesLoading } = useQuery({
    queryKey: ["linear-issues", slug],
    queryFn: () => fetchIssues(slug),
    enabled: !!slug,
  });

  // 🔹 Issue questions query
  const { data: questionsData } = useQuery<{
    countByIssue: Record<string, number>;
  }>({
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

  const filteredIssues = [...allIssues].sort((a: any, b: any) => {
    const aCount = questionCounts[a.id] ?? 0;
    const bCount = questionCounts[b.id] ?? 0;
    return bCount - aCount;
  });

  const businessReviewIssues = allIssues
    .filter((i: any) => i.state?.name === "Business Review")
    .sort(
      (a: any, b: any) =>
        (questionCounts[b.id] ?? 0) - (questionCounts[a.id] ?? 0),
    );

  const uatIssues = allIssues
    .filter((i: any) => i.state?.name === "UAT")
    .sort(
      (a: any, b: any) =>
        (questionCounts[b.id] ?? 0) - (questionCounts[a.id] ?? 0),
    );

  const noopFilterState = {
    selectedStatuses: [],
    onlyActive: false,
    availableStatuses: [],
    hasCycles: false,
    onToggleStatus: () => {},
    onToggleActive: () => {},
    onClearFilters: () => {},
  };

  const handleOpenChat = (title: string) => {
    const chatPath = pathname.replace(/\/[^/]+$/, "/chat");
    router.push(`${chatPath}?newChat=${encodeURIComponent(title)}`);
  };

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
      <div className="p-4 md:p-6 space-y-6 ">
        <div className="flex flex-col md:flex-row gap-4 md:gap-6 items-stretch">
          <div className="w-full md:w-1/3 flex flex-col">
            <ProgressPieChart issuesData={allIssues} />
          </div>
          <div className="w-full md:w-1/3 flex flex-col">
            <PriorityTasks
              issuesData={uatIssues}
              filterState={noopFilterState}
              onOpenChat={handleOpenChat}
              title="Acceptance Testing"
              questionCounts={questionCounts}
              compact
            />
          </div>
          <div className="w-full md:w-1/3 flex flex-col">
            <PriorityTasks
              issuesData={businessReviewIssues}
              filterState={noopFilterState}
              onOpenChat={handleOpenChat}
              title="Product Decisions"
              questionCounts={questionCounts}
              compact
            />
          </div>
        </div>

        <CreateIssue
          slug={slug}
          projectId={linearProjectId}
          profile={profile}
        />
      </div>
    </div>
  );
}
