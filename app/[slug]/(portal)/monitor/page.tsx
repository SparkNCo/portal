"use client";
import { Header } from "@/components/headerDashboard";
import { RoadmapTimeline } from "@/components/roadmap/roadmap-timeline";
import { useEffect, useMemo, useState } from "react";
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
import { API_HEADERS } from "@/lib/api-headers";
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
    data: roadmap,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["roadmap", slug],
    queryFn: async () => {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/roadmap/?slug=${encodeURIComponent(slug)}`,
        { headers: API_HEADERS },
      );

      if (!res.ok) throw new Error("Failed to fetch roadmap");
      return res.json();
    },
    enabled: Boolean(slug),
    // staleTime: 10_000,
  });

  const [projectNodes, setProjectNodes] = useState<any[]>([]);
  const [projectsCursor, setProjectsCursor] = useState<string | null>(null);
  const [hasMoreProjects, setHasMoreProjects] = useState(false);
  const [loadingMoreProjects, setLoadingMoreProjects] = useState(false);

  useEffect(() => {
    if (!roadmap?.initiative?.projects) return;

    setProjectNodes(roadmap.initiative.projects.nodes ?? []);
    setProjectsCursor(roadmap.initiative.projects.pageInfo?.endCursor ?? null);
    setHasMoreProjects(roadmap.initiative.projects.pageInfo?.hasNextPage ?? false);
  }, [roadmap]);

  async function handleLoadMoreProjects() {
    if (!slug || !projectsCursor || loadingMoreProjects) return;
    setLoadingMoreProjects(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/roadmap/?slug=${encodeURIComponent(slug)}&projectsAfter=${encodeURIComponent(projectsCursor)}`,
        { headers: API_HEADERS },
      );
      if (!res.ok) throw new Error("Failed to load more projects");
      const data = await res.json();
      const nextProjects = data?.initiative?.projects;
      setProjectNodes((prev) => [...prev, ...(nextProjects?.nodes ?? [])]);
      setProjectsCursor(nextProjects?.pageInfo?.endCursor ?? null);
      setHasMoreProjects(nextProjects?.pageInfo?.hasNextPage ?? false);
    } catch (err) {
      console.error("Failed to load more projects:", err);
    } finally {
      setLoadingMoreProjects(false);
    }
  }

  const allMilestones = useMemo(
    () =>
      projectNodes.flatMap((project: any) =>
        (project.projectMilestones?.nodes ?? []).map((milestone: any) => ({
          ...milestone,
          projectName: project.name,
        })),
      ),
    [projectNodes],
  );

  const allProjectNames: string[] = projectNodes.map((p: any) => p.name);

  const projectIdsByName: Record<string, string> = Object.fromEntries(
    projectNodes.map((p: any) => [p.name, p.id]),
  );

  const roadmapCycles = roadmap?.cycles?.nodes ?? [];

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
