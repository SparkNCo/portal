"use client";
import { Header } from "@/components/headerDashboard";
import { RoadmapTimeline } from "@/components/roadmap/roadmap-timeline";
import { useEffect, useState } from "react";
import { LoadingDataPanel } from "@/components/loader";
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

export default function RoadmapPage() {
  const { profile } = useUser();
  const customerSlug = useCustomerSlug();
  const { slug: urlSlug } = useParams<{ slug: string }>();
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
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/roadmap/?slug=${slug}`,
        { headers: API_HEADERS },
      );

      if (!res.ok) throw new Error("Failed to fetch roadmap");
      return res.json();
    },
    enabled: Boolean(slug),
    // staleTime: 10_000,
  });

  const [allMilestones, setAllMilestones] = useState<any[]>([]);

  useEffect(() => {
    if (!roadmap?.initiative?.projects?.nodes) return;

    const milestones = roadmap.initiative.projects.nodes.flatMap(
      (project: any) => {
        const projectName = project.name;

        return (project.projectMilestones?.nodes ?? []).map(
          (milestone: any) => ({
            ...milestone,
            projectName,
          }),
        );
      },
    );

    setAllMilestones(milestones);
  }, [roadmap]);

  const allProjectNames: string[] =
    roadmap?.initiative?.projects?.nodes?.map((p: any) => p.name) ?? [];

  const roadmapCycles = roadmap?.cycles?.nodes ?? [];

  if (isLoading) {
    return (
      <div className="min-h-screen">
        <Header title={pageTitle} subtitle="Project timeline and progress" />
        <LoadingDataPanel />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen">
        <Header title={pageTitle} subtitle="Project timeline and progress" />
        <p className="p-6 text-destructive">Failed to load roadmap</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header title={pageTitle} subtitle="Project timeline and progress" />
      <div className="p-4 md:p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          <div className="relative">
            <PinButton panelId="progress_pie_chart" />
            <ProgressPieChart issuesData={allIssues} />
          </div>
          <div className="relative">
            <PinButton panelId="software_kpis" />
            <SoftwareKPIs linearName={slug} />
          </div>
        </div>
        <div className="relative">
          <PinButton panelId="roadmap_timeline" />
          <RoadmapTimeline
            projectMilestones={allMilestones}
            allProjectNames={allProjectNames}
            cycles={roadmapCycles}
            slug={slug}
          />
        </div>
      </div>
      <div className="px-4 md:px-6 pb-6">
        <div className="relative">
          <PinButton panelId="metrics_panel" />
          <MetricsPanel slug={slug} />
        </div>
      </div>
    </div>
  );
}
