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
import { useRoadmapData } from "@/hooks/use-roadmap-data";
import { safeDecodeURIComponent } from "@/lib/utils";

export default function RoadmapPage() {
  const { profile } = useUser();
  const customerSlug = useCustomerSlug();
  const { slug: rawUrlSlug } = useParams<{ slug: string }>();
  const urlSlug = rawUrlSlug ? safeDecodeURIComponent(rawUrlSlug) : rawUrlSlug;
  const slug = customerSlug ?? urlSlug ?? profile?.linear_slug ?? "";

  const { data: issuesData } = useQuery({
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
    cycles: roadmapCycles,
    isLoading,
    error,
    hasMoreProjects,
    loadingMoreProjects,
    onLoadMoreProjects: handleLoadMoreProjects,
  } = useRoadmapData(slug);

  return (
    <div className="min-h-screen">
      <Header title={pageTitle} subtitle="Project timeline and progress" subtitleClassName="smalltext" />
      <div className="p-4 md:p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          <div className="relative">
            <PinButton panelId="progress_pie_chart" />
            <div className="pt-12">
              <ProgressPieChart issuesData={allIssues} />
            </div>
          </div>
          <div className="relative">
            <PinButton panelId="software_kpis" />
            <div className="pt-12">
              <SoftwareKPIs linearName={slug} />
            </div>
          </div>
        </div>
        <div className="relative">
          <PinButton panelId="roadmap_timeline" />
          <div className="pt-12">
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
                cycles={roadmapCycles}
                slug={slug}
                hasMoreProjects={hasMoreProjects}
                loadingMoreProjects={loadingMoreProjects}
                onLoadMoreProjects={handleLoadMoreProjects}
              />
            )}
          </div>
        </div>
      </div>
      <div className="px-4 md:px-6 pb-6">
        <div className="relative">
          <PinButton panelId="metrics_panel" />
          <div className="pt-12">
            <MetricsPanel slug={slug} />
          </div>
        </div>
      </div>
    </div>
  );
}
