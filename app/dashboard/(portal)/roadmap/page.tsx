"use client";
import { Header } from "@/components/headerDashboard";
import { RoadmapTimeline } from "@/components/roadmap/roadmap-timeline";
import { VelocityMetrics } from "@/components/roadmap/velocity-metrics";
import { SoftwareKPIs } from "@/components/roadmap/software-kpis";
import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { CardTitle } from "@/components/ui/card";
import { LoadingDataPanel } from "@/components/loader";

export default function RoadmapPage() {
  const searchParams = useSearchParams();
  const initiativeId = searchParams.get("id");
  const router = useRouter();

  const [loading, setLoadings] = useState(true);
  const [roadMapData, setRoadMapData] = useState([]);

  const getRoadMapData = async () => {
    const res = await fetch(`/api/linear/roadmap?initiativeId=${initiativeId}`);
    const issues = await res.json();

    if (issues?.projects?.nodes?.length > 0) {
      const projectId = issues.projects.nodes[1]?.id;

      setRoadMapData(issues.projects.nodes[1]);

      // 👇 update URL without navigation
      const params = new URLSearchParams(searchParams.toString());
      params.set("project", projectId);

      router.replace(`?${params.toString()}`, { scroll: false });
    }

    setLoadings(false);
  };

  useEffect(() => {
    getRoadMapData();
  }, []);

  return (
    <div className="min-h-screen">
      <Header title="Roadmap" subtitle="Project timeline and progress" />

      {loading ? (
        <LoadingDataPanel />
      ) : (
        <div className="p-6 space-y-6">
          <CardTitle
            className="text-base font-semibold flex items-center gap-2"
            onClick={() => console.log(roadMapData)}
          >
            Ver roadMapData
          </CardTitle>
          <RoadmapTimeline
            projectName={roadMapData?.name}
            projectMilestones={roadMapData?.projectMilestones?.nodes}
          />

          <div className="grid gap-6 lg:grid-cols-2">
            <VelocityMetrics />
            <SoftwareKPIs
              targetDate={roadMapData?.targetDate}
              progress={roadMapData?.progress}
            />
          </div>
        </div>
      )}
    </div>
  );
}
