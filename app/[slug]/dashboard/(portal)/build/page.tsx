"use client";

import { Header } from "@/components/headerDashboard";
import { PriorityTasks } from "@/components/client/priority-tasks";
import { FeatureRequestPanel } from "@/components/build/feature-request-panel";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useParams } from "next/navigation";
import { useUser } from "context/UserContext";
import { useCustomerSlug } from "context/CustomerSlugContext";
import { fetchIssues } from "../client/page";
import { PinButton } from "@/components/dashboard/pin-button";

export default function BuildPage() {
  const { profile } = useUser();
  const customerSlug = useCustomerSlug();
  const { slug: urlSlug } = useParams<{ slug: string }>();
  const slug = customerSlug ?? urlSlug ?? profile?.linear_slug ?? "";

  const [selectedProject, setSelectedProject] = useState<string | null>(null);

  const { data: issuesData } = useQuery({
    queryKey: ["linear-issues", slug],
    queryFn: () => fetchIssues(slug),
    enabled: !!slug,
  });

  const allIssues: any[] = issuesData ?? [];

  const businessReviewIssues = allIssues.filter(
    (i: any) => i.state?.name === "Business Review",
  );

  const uatIssues = allIssues.filter((i: any) => i.state?.name === "UAT");

  const noopFilterState = {
    selectedStatuses: [],
    onlyActive: false,
    availableStatuses: [],
    hasCycles: false,
    onToggleStatus: () => {},
    onToggleActive: () => {},
    onClearFilters: () => {},
  };

  const projects: { id: string; name: string }[] = Array.from(
    new Map(
      [...businessReviewIssues, ...uatIssues]
        .filter((i: any) => i.project?.id && i.project?.name)
        .map((i: any) => [
          i.project.id,
          { id: i.project.id, name: i.project.name },
        ]),
    ).values(),
  );

  const visibleBusinessReviewIssues = selectedProject
    ? businessReviewIssues.filter((i: any) => i.project?.id === selectedProject)
    : businessReviewIssues;

  const visibleUatIssues = selectedProject
    ? uatIssues.filter((i: any) => i.project?.id === selectedProject)
    : uatIssues;

  return (
    <div className="min-h-screen">
      <Header title="Build" subtitle="Guide new features" />

      <div className="p-4 md:p-6 space-y-6">
        <FeatureRequestPanel slug={slug} />
        <button onClick={() => console.log({})}>VER CONVER</button>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setSelectedProject(null)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
              selectedProject === null
                ? "bg-accent text-accent-foreground border-accent/40"
                : "border-border/40 text-muted-foreground hover:text-foreground hover:border-foreground/30"
            }`}
          >
            All Projects
          </button>
          {projects.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelectedProject(p.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                selectedProject === p.id
                  ? "bg-accent text-accent-foreground border-accent/40"
                  : "border-border/40 text-muted-foreground hover:text-foreground hover:border-foreground/30"
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          <div className="relative">
            <PinButton panelId="build_product_decisions" />
            <PriorityTasks
              issuesData={visibleBusinessReviewIssues}
              filterState={noopFilterState}
              onOpenChat={() => {}}
              title="Product Decisions"
              compact
            />
          </div>
          <div className="relative">
            <PinButton panelId="build_acceptance_testing" />
            <PriorityTasks
              issuesData={visibleUatIssues}
              filterState={noopFilterState}
              onOpenChat={() => {}}
              title="Acceptance Testing"
              compact
            />
          </div>
        </div>
      </div>
    </div>
  );
}
