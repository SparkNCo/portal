"use client";

import { Header } from "@/components/headerDashboard";
import { PriorityTasks, IssueDetailModal } from "@/components/client/priority-tasks";
import { FeatureRequestPanel } from "@/components/build/feature-request-panel";
import { SuggestedFeaturesRow } from "@/components/build/suggested-features-row";
import { EditIssueModal } from "@/components/build/edit-issue-modal";
import { useQuery } from "@tanstack/react-query";
import { Suspense, useState } from "react";
import { useParams } from "next/navigation";
import { useIssueDeepLink, useDeepLinkedIssueFallback, matchesIssueRef } from "@/hooks/use-issue-deep-link";
import { useUser } from "context/UserContext";
import { useCustomerSlug } from "context/CustomerSlugContext";
import { useSelectedProject } from "@/lib/selected-project-context";
import { fetchIssues } from "../dashboard/page";
import { PagePanel } from "@/components/dashboard/page-panel";
import { usePanelShowAll } from "@/hooks/use-user-layout";
import type { Issue } from "@/components/client/issues.types";
import { isClosedIssue } from "@/components/client/issues.types";
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

// Build's panels have no status filters.
const noopFilterState = {
  selectedStatuses: [],
  onlyActive: false,
  availableStatuses: [],
  hasCycles: false,
  onToggleStatus: () => {},
  onToggleActive: () => {},
  onClearFilters: () => {},
};

// One ticket panel: full width, with its "View all" kept per user.
function BuildTicketsPanel({
  panelId,
  title,
  loading,
  issues,
  slug,
  onEditIssue,
  openIssueId,
  openIssueTab,
  onDeepLinkClose,
}: Readonly<{
  panelId: string;
  title: string;
  loading: boolean;
  issues: Issue[];
  slug: string;
  onEditIssue: (issue: Issue) => void;
  openIssueId: ReturnType<typeof useIssueDeepLink>["openIssueId"];
  openIssueTab: ReturnType<typeof useIssueDeepLink>["openIssueTab"];
  onDeepLinkClose: () => void;
}>) {
  const showAll = usePanelShowAll("build", panelId);
  return (
    <PagePanel
      page="build"
      panelId={panelId}
      toolbar="inside"
      // Level with the header row; 1px lower on phones, where this wrapper
      // has its own border around the card's.
      cornerClassName="top-4 sm:top-[15px] right-3"
      expandable={false}
      // Phones: each panel its own bordered, rounded box (as on desktop),
      // so one category of tickets is clearly apart from the next.
      className="flex min-w-0 flex-col max-sm:overflow-hidden max-sm:rounded-xl max-sm:border max-sm:border-surface-line"
      contentClassName="flex-1 min-w-0"
    >
      <PriorityTasks
        loading={loading}
        issuesData={issues}
        filterState={noopFilterState}
        onOpenChat={() => {}}
        onEditIssue={onEditIssue}
        title={title}
        slug={slug}
        lightCard
        viewMode="row"
        reserveTopRight={1}
        expanded={showAll.expanded}
        onExpandedChange={showAll.set}
        openIssueId={openIssueId}
        openIssueTab={openIssueTab}
        onDeepLinkClose={onDeepLinkClose}
      />
    </PagePanel>
  );
}

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
  // Deep link from a notification (see components/notifications/
  // NotificationBell.tsx). If the issue isn't in any of this page's panels,
  // the fallback query further down fetches that one issue directly by id
  // and opens it in its own modal instead of silently landing here with
  // nothing open.
  const { openIssueId, openIssueTab, clearDeepLink } = useIssueDeepLink();
  // Aliased — this page already has its own `selectedProject` state below
  // for the Linear sub-project filter buttons, a different concept.
  const { selectedProject: selectedSidebarProject } = useSelectedProject();
  const { slug: rawUrlSlug } = useParams<{ slug: string }>();
  const urlSlug = rawUrlSlug ? safeDecodeURIComponent(rawUrlSlug) : rawUrlSlug;
  // Only used if there's no slug to go on: developers reach this page at
  // /{slug}/build (old /dev/build links redirect there), so the URL's slug
  // normally wins below.
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
  const { data: issuesData, isLoading: issuesLoading } = useQuery({
    queryKey: ["linear-issues", slug, "Business Review,UAT,Backlog"],
    queryFn: () => fetchIssues(slug, ["Business Review", "UAT", "Backlog"]),
    enabled: !!slug,
  });

  // Finished tickets (Approved in UAT, then Done) get their own query: they
  // pile up the most, so sharing the 100-issue cap above would crowd out the
  // active panels. Shown together in the "Approved" panel.
  const { data: doneData, isLoading: doneLoading } = useQuery({
    queryKey: ["linear-issues", slug, "Approved,Done"],
    queryFn: () => fetchIssues(slug, ["Approved", "Done"]),
    enabled: !!slug,
  });

  // "Recently Created": tickets of every status. Same query (and cache) as
  // the Dashboard's, Monitor's and Bugs' pages.
  const { data: everyIssueData, isLoading: everyIssueLoading } = useQuery({
    queryKey: ["linear-issues", slug],
    queryFn: () => fetchIssues(slug),
    enabled: !!slug,
  });

  const allIssues: any[] = issuesData ?? [];

  // Newest first, any status except finished ones (Done, Approved), which
  // have their own "Approved" panel.
  const recentIssues = (everyIssueData ?? []).filter((i: any) => !isClosedIssue(i)).sort(
    (a: any, b: any) =>
      new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime(),
  );

  const doneIssues = (doneData ?? [])
    .filter((i: any) => isClosedIssue(i))
    .sort(
      (a: any, b: any) =>
        new Date(b.completedAt ?? b.updatedAt ?? 0).getTime() -
        new Date(a.completedAt ?? a.updatedAt ?? 0).getTime(),
    );

  const businessReviewIssues = allIssues.filter(
    (i: any) => i.state?.name === "Business Review",
  );

  const uatIssues = allIssues
    .filter((i: any) => i.state?.name === "UAT")
    .sort(
      (a: any, b: any) =>
        new Date(b.updatedAt ?? 0).getTime() - new Date(a.updatedAt ?? 0).getTime(),
    );

  // "Refinement": Backlog tickets, last updated first.
  const refinementIssues = allIssues
    .filter((i: any) => i.state?.name === "Backlog")
    .sort(
      (a: any, b: any) =>
        new Date(b.updatedAt ?? 0).getTime() - new Date(a.updatedAt ?? 0).getTime(),
    );

  const projects: { id: string; name: string }[] = Array.from(
    new Map(
      [...businessReviewIssues, ...uatIssues, ...recentIssues, ...refinementIssues, ...doneIssues]
        .filter((i: any) => i.project?.id && i.project?.name)
        .map((i: any) => [
          i.project.id,
          { id: i.project.id, name: i.project.name },
        ]),
    ).values(),
  );

  const inSelectedProject = (issues: any[]) =>
    selectedProject ? issues.filter((i: any) => i.project?.id === selectedProject) : issues;

  // Top to bottom, each a full-width row of cards scrolling sideways.
  const panels: { panelId: string; title: string; issues: any[]; loading: boolean }[] = [
    { panelId: "build_product_decisions", title: "Business Reviews", issues: businessReviewIssues, loading: issuesLoading },
    { panelId: "build_acceptance_testing", title: "Acceptance Testing", issues: uatIssues, loading: issuesLoading },
    { panelId: "build_recently_created", title: "Recently Created", issues: recentIssues, loading: everyIssueLoading },
    // Id kept from when this panel was "Backlog" (pinned panels keep working).
    { panelId: "build_backlog", title: "Refinement", issues: refinementIssues, loading: issuesLoading },
    { panelId: "build_done", title: "Approved", issues: doneIssues, loading: doneLoading },
  ];

  // The deep-linked issue isn't necessarily in one of the panels above — a
  // decision/demo/design notification can point at an issue in any status.
  // Once they've all loaded and it's genuinely not among them, fetch that one
  // issue directly by id (same lookup EditIssueModal's "similar issue" hint
  // already uses) and open it in its own modal instead of leaving the deep
  // link a no-op.
  const foundInPanels = panels.some((p) => p.issues.some((i: any) => matchesIssueRef(i, openIssueId)));
  const fallbackIssue = useDeepLinkedIssueFallback({
    issueId: openIssueId,
    slug,
    enabled: !!issuesData && !!doneData && !!everyIssueData && !foundInPanels,
    onUnavailable: clearDeepLink,
  });

  return (
    <div className="min-h-screen">
      <Header title="Build" subtitle="Guide new features" subtitleClassName="smalltext" />

      <div className="p-4 md:p-6 space-y-6">
        <div className="-mx-4 sm:mx-0">
          <FeatureRequestPanel slug={slug} />
        </div>

        <div className="-mx-4 sm:mx-0">
          <SuggestedFeaturesRow slug={slug} />
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

        {/* One per row, the full width: a single row of tickets until "View
            all" shows every one in several rows (kept per user). The pin
            sits inside each panel's corner. */}
        {/* Not edge to edge on phones (no -mx-4): the side gutter shows each
            panel's border. */}
        <div className="grid grid-cols-1 gap-4 md:gap-6">
          {panels.map(({ panelId, title, issues, loading }) => (
            <BuildTicketsPanel
              key={panelId}
              panelId={panelId}
              title={title}
              loading={loading}
              issues={inSelectedProject(issues)}
              slug={slug}
              onEditIssue={setEditingIssue}
              openIssueId={openIssueId}
              openIssueTab={openIssueTab}
              onDeepLinkClose={clearDeepLink}
            />
          ))}
        </div>
      </div>

      {fallbackIssue && (
        <IssueDetailModal
          issue={fallbackIssue}
          slug={slug}
          onClose={clearDeepLink}
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
