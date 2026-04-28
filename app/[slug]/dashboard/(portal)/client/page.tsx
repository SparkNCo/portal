"use client";

import { Header } from "@/components/headerDashboard";
import { ProgressPieChart } from "@/components/client/progress-pie-chart";
import { PriorityTasks } from "@/components/client/priority-tasks";
import { LoadingDataPanel } from "@/components/loader";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { CreateIssue } from "@/components/shared/create-issue";
import { PolicyApprovalModal } from "@/components/ui/PolicyApprovalModal";
import { useUser } from "context/UserContext";
import { useCustomerSlug } from "context/CustomerSlugContext";

// 🔹 Fetch issues for dashboard
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
  const slug = customerSlug ?? profile?.linear_slug ?? "";
  const userId = profile?.id;
  const notionUrl = "https://www.notion.so/YOUR_POLICIES";
  const [showPoliciesModal, setShowPoliciesModal] = useState(false);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [onlyActive, setOnlyActive] = useState(false);

  // 🔹 Issues query
  const { data: issuesData, isLoading: issuesLoading } = useQuery({
    queryKey: ["linear-issues", slug],
    queryFn: () => fetchIssues(slug),
    enabled: !!slug,
  });

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

  const allIssues = issuesData ?? [];
  const availableStatuses = Array.from(
    new Set(allIssues.map((i: any) => i.state?.name).filter(Boolean)),
  ) as string[];
  const hasCycles = allIssues.some((i: any) => i.cycle !== undefined);

  const filteredIssues = allIssues.filter((issue: any) => {
    if (onlyActive && issue.cycle && !issue.cycle.isActive) return false;
    if (selectedStatuses.length > 0 && (!issue.state?.name || !selectedStatuses.includes(issue.state.name))) return false;
    return true;
  });

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
    onClearFilters: () => { setSelectedStatuses([]); setOnlyActive(false); },
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
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex flex-col md:flex-row gap-4 md:gap-6 items-stretch">
          <div className="w-full md:w-1/4 flex flex-col">
            <ProgressPieChart issuesData={filteredIssues} />
          </div>
          <div className="w-full md:w-3/4 flex flex-col">
            <PriorityTasks issuesData={filteredIssues} filterState={filterState} />
          </div>
        </div>

        <CreateIssue />

        <div className="grid gap-6 lg:grid-cols-2">
          {/*     <VelocityMetrics />
          <SoftwareKPIs /> */}
        </div>
      </div>{" "}
    </div>
  );
}
