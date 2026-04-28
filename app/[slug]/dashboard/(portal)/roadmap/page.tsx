"use client";
import { Header } from "@/components/headerDashboard";
import { RoadmapTimeline } from "@/components/roadmap/roadmap-timeline";
import { VelocityMetrics } from "@/components/roadmap/velocity-metrics";
import { SoftwareKPIs } from "@/components/roadmap/software-kpis";
import { useEffect, useState } from "react";
import { LoadingDataPanel } from "@/components/loader";
import { useUser } from "context/UserContext";
import { useCustomerSlug } from "context/CustomerSlugContext";
import { useQuery } from "@tanstack/react-query";
import { MetricsPanel } from "@/components/metrics/metrics-panel";

export default function RoadmapPage() {
  const { profile } = useUser();
  const customerSlug = useCustomerSlug();
  const slug = customerSlug ?? profile?.linear_slug ?? "";

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

  return (
    <div className="min-h-screen">
      <Header title="Roadmap" subtitle="Project timeline and progress" />
      <div className="p-6 space-y-6 ">
        <RoadmapTimeline projectMilestones={allMilestones} />

        <div className="grid gap-6 lg:grid-cols-2">
          <VelocityMetrics />
          <SoftwareKPIs linearName={slug} />
        </div>
      </div>
      <MetricsPanel />
    </div>
  );
}
