"use client";
import { Header } from "@/components/headerDashboard";
import { RoadmapTimeline } from "@/components/roadmap/roadmap-timeline";
import { Loader2 } from "lucide-react";
import { useUser } from "context/UserContext";
import { useCustomerSlug } from "context/CustomerSlugContext";
import { useQuery } from "@tanstack/react-query";
import { MetricsPanel } from "@/components/metrics/metrics-panel";
import { useParams } from "next/navigation";
import { ProgressPieChart } from "@/components/client/progress-pie-chart";
import { SoftwareKPIs } from "@/components/roadmap/software-kpis";
import { fetchIssues } from "../dashboard/page";
import { PinButton } from "@/components/dashboard/pin-button";
import { PagePanel } from "@/components/dashboard/page-panel";
import { useRoadmapData } from "@/hooks/use-roadmap-data";
import { safeDecodeURIComponent } from "@/lib/utils";
import { Suspense } from "react";
import { IssueDetailModal } from "@/components/client/priority-tasks";
import { useIssueDeepLink, useDeepLinkedIssueFallback, matchesIssueRef } from "@/hooks/use-issue-deep-link";

// A ticket link (SPA-500, the detail modal's "Copy link"):
// /{slug}/monitor?ticket=SPA-123&tab=decisions opens that ticket's detail
// modal on that tab — from this page's own issues when it's there, else
// looked up by number within this initiative (a ticket that isn't this
// customer's opens nothing). In its own Suspense, since reading the URL's
// params would otherwise suspend the whole page.
function MonitorTicketDeepLink({ slug, issues, loaded }: Readonly<{ slug: string; issues: any[]; loaded: boolean }>) {
  const { openIssueId, openIssueTab, clearDeepLink } = useIssueDeepLink();
  const inPage = openIssueId ? issues.find((i) => matchesIssueRef(i, openIssueId)) : undefined;
  const fallbackIssue = useDeepLinkedIssueFallback({
    issueId: openIssueId,
    slug,
    enabled: loaded && !inPage,
    onUnavailable: clearDeepLink,
  });
  const issue = inPage ?? fallbackIssue;
  if (!issue) return null;
  return <IssueDetailModal issue={issue} slug={slug} onClose={clearDeepLink} initialTab={openIssueTab} />;
}

export default function RoadmapPage() {
  const { profile } = useUser();
  const customerSlug = useCustomerSlug();
  const { slug: rawUrlSlug } = useParams<{ slug: string }>();
  const urlSlug = rawUrlSlug ? safeDecodeURIComponent(rawUrlSlug) : rawUrlSlug;
  const slug = customerSlug ?? urlSlug ?? profile?.linear_slug ?? "";

  const { data: issuesData, isSuccess: issuesLoaded } = useQuery({
    queryKey: ["linear-issues", slug],
    queryFn: () => fetchIssues(slug),
    enabled: !!slug,
  });

  const allIssues: any[] = issuesData ?? [];

  const pageTitle = "Monitor";

  const {
    milestones: allMilestones,
    projectNames: allProjectNames,
    projectIdsByName,
    projectColorByName,
    projectStatusByName,
    projectTargetDateByName,
    cycles: roadmapCycles,
    isLoading,
    error,
    hasMoreProjects,
    loadingMoreProjects,
    onLoadMoreProjects: handleLoadMoreProjects,
    completedPaging,
    upcomingPaging,
  } = useRoadmapData(slug);

  return (
    <div className="min-h-screen">
      <Header title={pageTitle} subtitle="Project timeline and progress" subtitleClassName="smalltext" />
      <div className="p-4 md:p-6 space-y-6">
        <div className="-mx-4 sm:mx-0 grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          {/* Pin and expand sit inside each card's corner, level with its
              title; the headers leave room so they cover nothing. */}
          <PagePanel page="monitor" panelId="progress_pie_chart" toolbar="inside" cornerClassName="top-6 right-6">
            <ProgressPieChart issuesData={allIssues} headerClassName="pr-16 md:pr-24" />
          </PagePanel>
          <PagePanel page="monitor" panelId="software_kpis" toolbar="inside" cornerClassName="top-6 right-6">
            <SoftwareKPIs linearName={slug} headerClassName="pr-16 md:pr-24" />
          </PagePanel>
        </div>
        <div className="relative -mx-4 sm:mx-0">
          {/* The pin sits inside the timeline card's corner; its header moves
              the cycle arrows left of it. */}
          <div className="absolute top-[30px] right-6 z-10">
            <PinButton panelId="roadmap_timeline" inline />
          </div>
          <div>
            {isLoading && (
              <div className="w-full flex items-center justify-center py-16 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                Loading roadmap…
              </div>
            )}
            {!isLoading && error && (
              <p className="p-6 text-destructive">Failed to load roadmap</p>
            )}
            {!isLoading && !error && (
              <RoadmapTimeline
                projectMilestones={allMilestones}
                allProjectNames={allProjectNames}
                projectIdsByName={projectIdsByName}
                projectColorByName={projectColorByName}
                projectStatusByName={projectStatusByName}
                projectTargetDateByName={projectTargetDateByName}
                cycles={roadmapCycles}
                slug={slug}
                hasMoreProjects={hasMoreProjects}
                loadingMoreProjects={loadingMoreProjects}
                onLoadMoreProjects={handleLoadMoreProjects}
                completedPaging={completedPaging}
                upcomingPaging={upcomingPaging}
                headerClassName="pr-16"
              />
            )}
          </div>
        </div>
      </div>
      <div className="px-4 md:px-6 pb-6">
        <MetricsPanel slug={slug} pinPanelId="metrics_panel" />
      </div>
      <Suspense fallback={null}>
        <MonitorTicketDeepLink slug={slug} issues={allIssues} loaded={issuesLoaded} />
      </Suspense>
    </div>
  );
}
