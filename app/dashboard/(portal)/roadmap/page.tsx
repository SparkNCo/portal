"use client";
import { Header } from "@/components/headerDashboard";
import { RoadmapTimeline } from "@/components/roadmap/roadmap-timeline";
import { VelocityMetrics } from "@/components/roadmap/velocity-metrics";
import { SoftwareKPIs } from "@/components/roadmap/software-kpis";
import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { LoadingDataPanel } from "@/components/loader";
import { useQuery } from "@tanstack/react-query";

export default function RoadmapPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initiativeId = searchParams.get("id");

  const {
    data: roadmap,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["roadmap", initiativeId],
    queryFn: async () => {
      const res = await fetch(
        `/api/linear/roadmap?initiativeId=${initiativeId}`,
      );
      if (!res.ok) throw new Error("Failed to fetch roadmap");
      return res.json();
    },
    enabled: !!initiativeId,
    staleTime: 10_000,
  });
  const [allMilestones, setAllMilestones] = useState<any[]>([]);

  useEffect(() => {
    if (!roadmap?.projects?.nodes) return;

    const milestones = roadmap.projects.nodes.flatMap((project: any) => {
      const projectName = project.name;

      return (project.projectMilestones?.nodes ?? []).map((milestone: any) => ({
        ...milestone,
        projectName, 
      }));
    });

    setAllMilestones(milestones);
  }, [roadmap]);

  useEffect(() => {
    if (!roadmap?.projects?.nodes?.length) return;
    const projectIds = roadmap.projects.nodes
      .map((p: any) => p.id)
      .filter(Boolean);
    if (!projectIds.length) return;
    const params = new URLSearchParams(searchParams.toString());
    const existing = params.get("projects");
    const next = projectIds.join("--");
    if (existing === next) return;
    params.set("projects", next);
    router.replace(`?${params.toString()}`, { scroll: false });
  }, [roadmap, router, searchParams]);

  if (isLoading) {
    return (
      <div className="min-h-screen">
        <Header title="Roadmap" subtitle="Project timeline and progress" />
        <LoadingDataPanel />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen">
        <Header title="Roadmap" subtitle="Project timeline and progress" />
        <p className="p-6 text-destructive">Failed to load roadmap</p>
      </div>
    );
  }

  const project = roadmap?.projects?.nodes?.[2];

  const ver = () => {
    console.log({
      allMilestones: roadmap,
    });
  };

  return (
    <div className="min-h-screen">
      <Header title="Roadmap" subtitle="Project timeline and progress" />

      <div
        onClick={() => {
          ver();
        }}
      >
        {" "}
        VER Roadmap{" "}
      </div>
      <div className="p-6 space-y-6">
        <RoadmapTimeline projectMilestones={allMilestones} />

        <div className="grid gap-6 lg:grid-cols-2">
          <VelocityMetrics />
          <SoftwareKPIs
            targetDate={project?.targetDate}
            progress={project?.progress}
          />
        </div>
      </div>
    </div>
  );
}
