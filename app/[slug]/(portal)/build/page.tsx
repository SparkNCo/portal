"use client";

import { Header } from "@/components/headerDashboard";
import { PriorityTasks, IssueDetailModal } from "@/components/client/priority-tasks";
import { FeatureRequestPanel } from "@/components/build/feature-request-panel";
import { EditIssueModal } from "@/components/build/edit-issue-modal";
import { useQuery } from "@tanstack/react-query";
import { Suspense, useState } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import type { IssueDetailTab } from "@/components/client/issues.types";
import { useUser } from "context/UserContext";
import { useCustomerSlug } from "context/CustomerSlugContext";
import { useSelectedProject } from "@/lib/selected-project-context";
import { fetchIssues } from "../dashboard/page";
import { API_HEADERS } from "@/lib/api-headers";
import { PinButton } from "@/components/dashboard/pin-button";
import type { Issue } from "@/components/client/issues.types";
import { safeDecodeURIComponent } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Radix Select reserves the empty string for "no value" internally, so "no
// project selected" (show every project) needs its own sentinel instead.
const ALL_PROJECTS_VALUE = "__all__";

export default function BuildPage() {
  return (
    <Suspense fallback={null}>
      <BuildPageContent />
    </Suspense>
  );
}

function BuildPageContent() {
  const { profile } = useUser();
  const customerSlug = useCustomerSlug();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // Deep link from a notification (see components/notifications/
  // NotificationBell.tsx). This page only ever fetches Business Review/UAT/
  // Backlog issues (see the issuesData query below) — for anything else,
  // the fallback query further down fetches that one issue directly by id
  // and opens it in its own modal instead of silently landing here with
  // nothing open.
  const openIssueId = searchParams.get("issueId");
  const openIssueTab = (searchParams.get("tab") as IssueDetailTab | null) ?? undefined;
  // Aliased — this page already has its own `selectedProject` state below
  // for the Linear sub-project filter buttons, a different concept.
  const { selectedProject: selectedSidebarProject } = useSelectedProject();
  const { slug: rawUrlSlug } = useParams<{ slug: string }>();
  const urlSlug = rawUrlSlug ? safeDecodeURIComponent(rawUrlSlug) : rawUrlSlug;
  // Developers have no `[slug]` route segment under `/dev/build` — fall back
  // to whichever project is selected in the sidebar dropdown (see
  // components/sidebar.tsx), defaulting to their first assignment the same
  // way that dropdown does.
  const developerProject =
    profile?.role === "developer"
      ? (selectedSidebarProject ?? profile?.assignment_id?.[0]?.clientName ?? null)
      : null;
  const slug = customerSlug ?? urlSlug ?? profile?.linear_slug ?? developerProject ?? "";

  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [editingIssue, setEditingIssue] = useState<Issue | null>(null);

  // Linear's issues query has no pagination and caps at 100 results — fetching
  // every issue for the project (all statuses, full history) risks Business
  // Review / UAT / Backlog tickets falling outside that cap. Filtering by
  // status server-side keeps the result set to just what this page needs.
  const { data: issuesData } = useQuery({
    queryKey: ["linear-issues", slug, "Business Review,UAT,Backlog"],
    queryFn: () => fetchIssues(slug, ["Business Review", "UAT", "Backlog"]),
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

  const backlogIssues = allIssues
    .filter((i: any) => i.state?.name === "Backlog")
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
      [...businessReviewIssues, ...uatIssues, ...backlogIssues]
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

  const visibleBacklogIssues = selectedProject
    ? backlogIssues.filter((i: any) => i.project?.id === selectedProject)
    : backlogIssues;

  // The deep-linked issue isn't necessarily in Business Review/UAT/Backlog —
  // a decision/demo/design notification can point at an issue in any status
  // (In Progress, Todo, Done, ...). Once the three panels above have loaded
  // and it's genuinely not among them, fetch that one issue directly by id
  // (same lookup EditIssueModal's "similar issue" hint already uses) and
  // open it in its own modal instead of leaving the deep link a no-op.
  const foundInPanels = allIssues.some((i: any) => i.id === openIssueId);
  const { data: fallbackIssue } = useQuery({
    queryKey: ["issue-by-id", openIssueId],
    queryFn: async () => {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/issues/by-id?id=${openIssueId}`,
        { headers: API_HEADERS },
      );
      if (!res.ok) throw new Error("Failed to fetch issue");
      return res.json() as Promise<Issue>;
    },
    enabled: !!openIssueId && !!issuesData && !foundInPanels,
  });

  return (
    <div className="min-h-screen">
      <Header title="Build" subtitle="Guide new features" subtitleClassName="smalltext" />

      <div className="p-4 md:p-6 space-y-6">
        <div className="-mx-4 sm:mx-0">
          <FeatureRequestPanel slug={slug} />
        </div>
        {projects.length > 0 && (
          <Select
            value={selectedProject ?? ALL_PROJECTS_VALUE}
            onValueChange={(value) =>
              setSelectedProject(value === ALL_PROJECTS_VALUE ? null : value)
            }
          >
            <SelectTrigger className="h-8 w-[200px] smalltext">
              <SelectValue placeholder="All Projects" />
            </SelectTrigger>
            <SelectContent align="start">
              <SelectItem value={ALL_PROJECTS_VALUE} className="smalltext">
                All Projects
              </SelectItem>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id} className="smalltext">
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <div className="-mx-4 sm:mx-0 grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          <div className="relative">
            <PinButton panelId="build_product_decisions" />
            <div className="pt-12 flex-1">
              <PriorityTasks
                issuesData={visibleBusinessReviewIssues}
                filterState={noopFilterState}
                onOpenChat={() => {}}
                onEditIssue={(issue) => setEditingIssue(issue)}
                title="Business Reviews"
                slug={slug}
                lightCard
                openIssueId={openIssueId}
                openIssueTab={openIssueTab}
              />
            </div>
          </div>
          <div className="relative flex flex-col">
            <PinButton panelId="build_acceptance_testing" />
            <div className="pt-12 flex-1">
              <PriorityTasks
                issuesData={visibleUatIssues}
                filterState={noopFilterState}
                onOpenChat={() => {}}
                onEditIssue={(issue) => setEditingIssue(issue)}
                title="Acceptance Testing"
                slug={slug}
                lightCard
                openIssueId={openIssueId}
                openIssueTab={openIssueTab}
              />
            </div>
          </div>
        </div>

        <div className="-mx-4 sm:mx-0 relative flex flex-col">
          <PinButton panelId="build_backlog" />
          <div className="pt-12 flex-1">
            <PriorityTasks
              issuesData={visibleBacklogIssues}
              filterState={noopFilterState}
              onOpenChat={() => {}}
              onEditIssue={(issue) => setEditingIssue(issue)}
              title="Backlog"
              slug={slug}
              lightCard
              openIssueId={openIssueId}
              openIssueTab={openIssueTab}
            />
          </div>
        </div>
      </div>

      {fallbackIssue && (
        <IssueDetailModal
          issue={fallbackIssue}
          slug={slug}
          onClose={() => router.replace(pathname)}
          initialTab={openIssueTab}
        />
      )}

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
