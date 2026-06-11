"use client";

import { Header } from "@/components/headerDashboard";
import { ProgressPieChart } from "@/components/client/progress-pie-chart";
import { PriorityTasks } from "@/components/client/priority-tasks";
import { LoadingDataPanel } from "@/components/loader";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useRouter, usePathname, useParams } from "next/navigation";
import { CreateIssue } from "@/components/shared/create-issue";
import { useUser } from "context/UserContext";
import { useCustomerSlug } from "context/CustomerSlugContext";
import { API_HEADERS } from "@/lib/api-headers";
import { SoftwareKPIs } from "@/components/roadmap/software-kpis";
import { Button } from "@/components/components/ui/button";

export async function fetchIssues(slug: string, ticketStatuses: string[] = []) {
  const statuses = [...new Set(ticketStatuses)];
  console.log("CALLING");

  const params = new URLSearchParams({
    slug,
    ticket_statuses: statuses.join(","),
  });
  console.log("hola");
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_ENDPOINT}/issues?${params.toString()}`,
    { headers: API_HEADERS },
  );
  console.log("END CCALL");

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
  const linearProjectId = "";
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(
    new Set(),
  );

  // 🔹 Issues query
  const { data: issuesData, isLoading: issuesLoading } = useQuery({
    queryKey: ["linear-issues", slug],
    queryFn: () => fetchIssues(slug),
    enabled: !!slug,
  });

  const allIssues: any[] = issuesData ?? [];

  const projects: { id: string; name: string }[] = Array.from(
    new Map(
      allIssues
        .filter((i: any) => i.project?.id && i.project?.name)
        .map((i: any) => [
          i.project.id,
          { id: i.project.id, name: i.project.name },
        ]),
    ).values(),
  );

  const toggleProject = (id: string) =>
    setSelectedProjects((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const issueMatchesProject = (i: any) =>
    selectedProjects.size === 0 || selectedProjects.has(i.project?.id);

  const businessReviewIssues = allIssues.filter(
    (i: any) => i.state?.name === "Business Review" && issueMatchesProject(i),
  );

  const uatIssues = allIssues.filter(
    (i: any) => i.state?.name === "UAT" && issueMatchesProject(i),
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

  if (issuesLoading) return <LoadingDataPanel />;

  return (
    <div className="min-h-screen">
      <Header
        title="Client Dashboard"
        subtitle={`Welcome back, ${profile?.email ?? "User"}`}
      />
      <div className="p-4 md:p-6 space-y-6 ">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              size="sm"
              onClick={() => setSelectedProjects(new Set())}
              className={
                selectedProjects.size === 0
                  ? "bg-accent text-accent-foreground hover:bg-accent/90"
                  : "bg-secondary text-muted-foreground hover:bg-secondary/80"
              }
            >
              All
            </Button>
            {projects.map((p) => (
              <Button
                key={p.id}
                size="sm"
                onClick={() => toggleProject(p.id)}
                className={
                  selectedProjects.has(p.id)
                    ? "bg-accent text-accent-foreground hover:bg-accent/90"
                    : "bg-secondary text-muted-foreground hover:bg-secondary/80"
                }
              >
                {p.name}
              </Button>
            ))}
          </div>
          <CreateIssue
            slug={slug}
            projectId={linearProjectId}
            profile={profile}
            compact
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          <ProgressPieChart issuesData={allIssues} />
          <SoftwareKPIs linearName={slug} />
          <PriorityTasks
            issuesData={businessReviewIssues}
            filterState={noopFilterState}
            onOpenChat={handleOpenChat}
            title="Product Decisions"
            compact
          />
          <PriorityTasks
            issuesData={uatIssues}
            filterState={noopFilterState}
            onOpenChat={handleOpenChat}
            title="Acceptance Testing"
            compact
          />
        </div>
      </div>
    </div>
  );
}
