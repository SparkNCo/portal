"use client";

import { Header } from "@/components/headerDashboard";
import { PriorityTasks } from "@/components/client/priority-tasks";
import { FeatureRequestPanel } from "@/components/build/feature-request-panel";
import { EditIssueModal } from "@/components/build/edit-issue-modal";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useParams } from "next/navigation";
import { useUser } from "context/UserContext";
import { useCustomerSlug } from "context/CustomerSlugContext";
import { fetchIssues } from "../dashboard/page";
import { PinButton } from "@/components/dashboard/pin-button";
import type { Issue } from "@/components/client/issues.types";
import { safeDecodeURIComponent } from "@/lib/utils";

export default function BuildPage() {
  const { profile } = useUser();
  const customerSlug = useCustomerSlug();
  const { slug: rawUrlSlug } = useParams<{ slug: string }>();
  const urlSlug = rawUrlSlug ? safeDecodeURIComponent(rawUrlSlug) : rawUrlSlug;
  const slug = customerSlug ?? urlSlug ?? profile?.linear_slug ?? "";

  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [editingIssue, setEditingIssue] = useState<Issue | null>(null);

  // Linear's issues query has no pagination and caps at 100 results — fetching
  // every issue for the project (all statuses, full history) risks Business
  // Review / UAT tickets falling outside that cap. Filtering by status
  // server-side keeps the result set to just what this page needs.
  const { data: issuesData } = useQuery({
    queryKey: ["linear-issues", slug, "Business Review,UAT"],
    queryFn: () => fetchIssues(slug, ["Business Review", "UAT"]),
    enabled: !!slug,
  });

  const allIssues: any[] = issuesData ?? [];

  const businessReviewIssues = allIssues.filter(
    (i: any) => i.state?.name === "Business Review",
  );

  const uatIssues = allIssues
    .filter((i: any) => i.state?.name === "UAT")
    .sort(
      (a: any, b: any) =>
        new Date(b.updatedAt ?? 0).getTime() - new Date(a.updatedAt ?? 0).getTime(),
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
      <Header title="Build" subtitle="Guide new features" subtitleClassName="smalltext" />

      <div className="p-4 md:p-6 space-y-6">
        <FeatureRequestPanel slug={slug} />
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setSelectedProject(null)}
            className={`px-3 py-1.5 rounded-md smalltext font-medium border transition-colors ${
              selectedProject === null
                ? "bg-primary text-primary-foreground border-primary/40"
                : "border-border/40 text-muted-foreground hover:text-foreground hover:border-foreground/30"
            }`}
          >
            All Projects
          </button>
          {projects.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelectedProject(p.id)}
              className={`px-3 py-1.5 rounded-md smalltext font-medium border transition-colors ${
                selectedProject === p.id
                  ? "bg-primary text-primary-foreground border-primary/40"
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
              onEditIssue={(issue) => setEditingIssue(issue)}
              title="Business Reviews"
              slug={slug}
              compact
              lightCard
            />
          </div>
          <div className="relative">
            <PinButton panelId="build_acceptance_testing" />
            <PriorityTasks
              issuesData={visibleUatIssues}
              filterState={noopFilterState}
              onOpenChat={() => {}}
              onEditIssue={(issue) => setEditingIssue(issue)}
              title="Acceptance Testing"
              slug={slug}
              compact
              lightCard
            />
          </div>
        </div>
      </div>

      {editingIssue && (
        <EditIssueModal
          issue={editingIssue}
          slug={slug}
          onClose={() => setEditingIssue(null)}
        />
      )}
    </div>
  );
}
