"use client";
import { Header } from "@/components/headerDashboard";
import { RoadmapTimeline } from "@/components/roadmap/roadmap-timeline";
import { VelocityMetrics } from "@/components/roadmap/velocity-metrics";
import { SoftwareKPIs } from "@/components/roadmap/software-kpis";
import { useEffect, useState } from "react";
import { useSearchParams, useRouter, useParams } from "next/navigation";
import { LoadingDataPanel } from "@/components/loader";
import { useQuery } from "@tanstack/react-query";

export default function RoadmapPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const params = useParams();
  const slug = params.slug as string;

  const {
    data: roadmap,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["roadmap", slug],
    queryFn: async () => {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_ENDPOINT}/roadmap/?slug=${slug}`,
        {
          headers: {
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_APIKEY}`,
            apikey: process.env.NEXT_PUBLIC_APIKEY!,
            "Content-Type": "application/json",
          },
        },
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
    console.log("roadmap", roadmap);

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

  /* useEffect(() => {
    if (!roadmap?.initiative?.projects?.nodes?.length) return;
    const projectIds = roadmap.initiative.projects.nodes
      .map((p: any) => p.id)
      .filter(Boolean);
    if (!projectIds.length) return;
    const params = new URLSearchParams(searchParams.toString());
    const existing = params.get("projects");
    const next = projectIds.join("--");
    if (existing === next) return;
    params.set("projects", next);
  }, [roadmap, router, searchParams]); */

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

  return (
    <div className="min-h-screen">
      <Header title="Roadmap" subtitle="Project timeline and progress" />
      <div onClick={() => console.log({ roadmap })}>VER roadmap</div>

      <div
        className="text-foreground"
        onClick={() => console.log({ allMilestones })}
      >
        VER allMilestones
      </div>

      <div className="p-6 space-y-6">
        <RoadmapTimeline projectMilestones={allMilestones} />

        <div className="grid gap-6 lg:grid-cols-2">
          <VelocityMetrics />
          <SoftwareKPIs
          /* targetDate={project?.targetDate}
            progress={project?.progress} */
          />
        </div>
      </div>
    </div>
  );
}
